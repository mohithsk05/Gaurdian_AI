from datetime import datetime, timedelta
import re
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, EmailStr
from app.config import settings
from app.database import get_db, User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

# Prompt Injection Attack Patterns
PROMPT_INJECTION_PATTERNS = [
    r"(?i)ignore\s+(?:all\s+)?previous\s+instructions",
    r"(?i)system\s+override",
    r"(?i)you\s+are\s+now\s+a\s+",
    r"(?i)act\s+as\s+a\s+[^.]+and\s+forget\s+",
    r"(?i)forget\s+(?:everything\s+)?you\s+were\s+told",
    r"(?i)bypass\s+safety",
    r"(?i)dan\s+mode",
    r"(?i)jailbreak",
    r"(?i)<script>.*?</script>"
]

# Validation Models
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    password: str = Field(..., min_length=6, max_length=100)
    role: str = Field(default="USER", pattern=r"^(USER|RESPONDER)$")

class UserLogin(BaseModel):
    username: str = Field(...)
    password: str = Field(...)

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class EmergencyAlertCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=100)
    description: str = Field(..., min_length=10, max_length=1000)
    location: str = Field(..., min_length=2, max_length=100)
    severity: str = Field(..., pattern=r"^(LOW|MEDIUM|HIGH|CRITICAL)$")

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    conversation_id: str = Field(..., min_length=5, max_length=50)

# Cryptography Helper
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

# JWT helper
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

# Dependency to get current user from JWT
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username, role=payload.get("role"))
    except JWTError:
        raise credentials_exception
        
    user = db.query(User).filter(User.username == token_data.username).first()
    if user is None:
        raise credentials_exception
    return user

# Role-Based Access Control Guards
def check_role(allowed_roles: list[str]):
    def role_dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action requires role: {allowed_roles}"
            )
        return current_user
    return role_dependency

# Prompt Injection Protection Filter
def scan_prompt_for_injection(prompt: str) -> bool:
    """
    Scans a prompt for common prompt injection patterns.
    Returns True if an injection attempt is detected, False otherwise.
    """
    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, prompt):
            return True
    return False

def sanitize_and_validate_prompt(prompt: str) -> str:
    """
    Scans the prompt. If injection is detected, raises an HTTP exception.
    Otherwise, returns the sanitized prompt (stripping HTML tag fragments).
    """
    if scan_prompt_for_injection(prompt):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Security Alert: Potential prompt injection or system override detected. Input rejected."
        )
    # Simple sanitization - remove script tags or malicious tags
    clean = re.sub(r"<[^>]*>", "", prompt)
    return clean.strip()
