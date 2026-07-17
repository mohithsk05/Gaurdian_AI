import os

class Settings:
    PROJECT_NAME: str = "GuardianAI"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = os.getenv("JWT_SECRET", "super-secret-key-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./guardian_ai.db")
    
    # Gemini API Key
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    
    # MCP Server configuration
    MCP_SERVER_COMMAND: str = os.getenv("MCP_SERVER_COMMAND", "python C:/Users/Sujan/.gemini/antigravity/scratch/guardian-ai/mcp-server/server.py")

settings = Settings()
