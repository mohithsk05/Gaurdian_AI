import uuid
from typing import List, Dict, Any
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime

from app.config import settings
from app.database import init_db, get_db, User, Conversation, Message
from app.security import (
    UserCreate, Token, UserLogin, ChatRequest, EmergencyAlertCreate,
    verify_password, get_password_hash, create_access_token,
    get_current_user, check_role, sanitize_and_validate_prompt
)
from app.agents.adk_orchestration import CoordinatorAgent
from app.mcp.mcp_client import mcp_client

app = FastAPI(title=settings.PROJECT_NAME, version="1.0.0")

# Set up CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

coordinator = CoordinatorAgent()

# Track active emergency alerts in-memory (or simple DB table if preferred; we'll use a local database query or mock list for alerts)
active_alerts = [
    {
        "id": "alert-1",
        "title": "Severe Flash Flood Warning",
        "description": "Torrential monsoon rain has caused severe water-logging in Mumbai low-lying sectors. Avoid subway passages and low roads.",
        "location": "Mumbai",
        "severity": "CRITICAL",
        "timestamp": datetime.utcnow().isoformat()
    },
    {
        "id": "alert-2",
        "title": "High Wind Advisory",
        "description": "Sustained winds up to 50 km/h and gusts up to 75 km/h. Secure loose outdoor structures and stay indoors.",
        "location": "Mumbai",
        "severity": "HIGH",
        "timestamp": datetime.utcnow().isoformat()
    }
]

@app.on_event("startup")
async def startup_event():
    # Initialize DB tables
    init_db()
    # Connect to MCP Server
    await mcp_client.connect()

@app.on_event("shutdown")
async def shutdown_event():
    # Disconnect MCP Server
    await mcp_client.disconnect()

# --- AUTHENTICATION ENDPOINTS ---

@app.post(f"{settings.API_V1_STR}/auth/register", response_model=Dict[str, Any])
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user_in.username).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered."
        )
    hashed_pwd = get_password_hash(user_in.password)
    new_user = User(username=user_in.username, hashed_password=hashed_pwd, role=user_in.role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "Registration successful", "username": new_user.username, "role": new_user.role}

@app.post(f"{settings.API_V1_STR}/auth/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.username, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get(f"{settings.API_V1_STR}/auth/me", response_model=Dict[str, Any])
def read_users_me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "username": current_user.username, "role": current_user.role}

# --- CONVERSATION ENDPOINTS ---

@app.get(f"{settings.API_V1_STR}/conversations", response_model=List[Dict[str, Any]])
def list_conversations(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    convs = db.query(Conversation).filter(Conversation.user_id == current_user.id).order_by(Conversation.created_at.desc()).all()
    return [{"id": c.id, "title": c.title, "created_at": c.created_at} for c in convs]

@app.get(f"{settings.API_V1_STR}/conversations/{{conversation_id}}/messages", response_model=List[Dict[str, Any]])
def list_messages(conversation_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found or access denied.")
        
    messages = db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.created_at.asc()).all()
    
    resp = []
    for m in messages:
        resp.append({
            "id": m.id,
            "sender": m.sender,
            "content": m.content,
            "agent_name": m.agent_name,
            "timeline_data": m.get_timeline_data(),
            "created_at": m.created_at
        })
    return resp

# --- MULTI-AGENT CHAT & ORCHESTRATION ---

@app.post(f"{settings.API_V1_STR}/chat", response_model=Dict[str, Any])
async def chat_interaction(
    payload: ChatRequest, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    # 1. Input validation & Prompt Injection Filter
    # Raises 400 Bad Request if prompt injection keywords are detected.
    sanitized_message = sanitize_and_validate_prompt(payload.message)
    
    # 2. Get or create conversation (isolated per user)
    conv_id = payload.conversation_id
    conv = db.query(Conversation).filter(Conversation.id == conv_id, Conversation.user_id == current_user.id).first()
    if not conv:
        # Create a new conversation if it doesn't exist
        title = sanitized_message[:40] + ("..." if len(sanitized_message) > 40 else "")
        conv = Conversation(id=conv_id, title=title, user_id=current_user.id)
        db.add(conv)
        db.commit()
    
    # 3. Save User Message
    user_msg = Message(
        conversation_id=conv_id,
        sender="user",
        content=sanitized_message
    )
    db.add(user_msg)
    db.commit()
    
    # 4. Trigger Coordinator Agent Orchestration
    try:
        orch_result = await coordinator.route_and_orchestrate(sanitized_message)
        final_plan = orch_result["final_plan"]
        timeline = orch_result["timeline"]
        
        # 5. Save Coordinator Answer and Execution Timeline details
        coord_msg = Message(
            conversation_id=conv_id,
            sender="coordinator",
            content=final_plan
        )
        coord_msg.set_timeline_data(timeline)
        db.add(coord_msg)
        db.commit()
        
        return {
            "conversation_id": conv_id,
            "response": final_plan,
            "timeline": timeline
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Orchestration Error: {str(e)}"
        )

# --- ALERTS MANAGEMENT ENDPOINTS ---

@app.get(f"{settings.API_V1_STR}/alerts", response_model=List[Dict[str, Any]])
def get_alerts():
    # Public endpoint to pull active disaster warnings
    return active_alerts

@app.post(f"{settings.API_V1_STR}/alerts", response_model=Dict[str, Any])
def create_alert(
    alert_in: EmergencyAlertCreate, 
    current_user: User = Depends(check_role(["RESPONDER"]))
):
    # Only emergency responders can publish new warnings
    new_alert = {
        "id": f"alert-{uuid.uuid4()}",
        "title": alert_in.title,
        "description": alert_in.description,
        "location": alert_in.location,
        "severity": alert_in.severity,
        "timestamp": datetime.utcnow().isoformat()
    }
    active_alerts.insert(0, new_alert)
    return {"message": "Emergency alert issued successfully", "alert": new_alert}

# --- HELPLINES & PUBLIC RESOURCES ---

@app.get(f"{settings.API_V1_STR}/helplines", response_model=Dict[str, Any])
async def get_helpline_directory(region: str = "Mumbai"):
    try:
        # Fetch helpline data directly using MCP tool
        result = await mcp_client.call_tool("get_emergency_helplines", {"region": region})
        content = result.get("content", [])
        if content:
            import json
            return json.loads(content[0].get("text", "{}"))
    except Exception:
        pass
        
    # Standard static fallback if tool execution fails
    return {
        "region": region,
        "contacts": [
            {"name": "National Emergency Service", "number": "112", "hours": "24/7"},
            {"name": "NDMA Disaster Helpline", "number": "011-26701728", "hours": "24/7"},
            {"name": "KEM Hospital Emergency Desk", "number": "022-24107000", "hours": "24/7"}
        ]
    }
