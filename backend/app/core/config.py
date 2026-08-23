"""
Central application configuration.
All values are read from environment variables (.env). Sensible local-dev
defaults are provided so the app boots without any API keys configured —
AI-dependent features gracefully fall back to rule-based logic when keys
are missing (see services/llm_service.py).
"""
from functools import lru_cache
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # --- App ---
    APP_NAME: str = "AI Resume Screening Platform"
    ENV: str = "development"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = True

    # --- Security ---
    SECRET_KEY: str = "CHANGE_ME_super_secret_key_dev_only"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24h

    # --- CORS ---
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # --- Database ---
    # Works with local Postgres or a Supabase Postgres connection string.
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/resume_platform"

    # --- File storage ---
    STORAGE_DIR: str = "storage/resumes"
    MAX_UPLOAD_MB: int = 15
    ALLOWED_EXTENSIONS: List[str] = [".pdf", ".docx"]

    # --- OCR ---
    OCR_ENABLED: bool = True
    TESSERACT_CMD: Optional[str] = None  # set if tesseract isn't on PATH

    # --- Embeddings / semantic search ---
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    VECTOR_STORE_DIR: str = "chroma_db"

    # --- LLM providers (bring your own key) ---
    LLM_PROVIDER: str = "none"  # "openai" | "gemini" | "none"
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-1.5-flash"

    # --- Scoring weights (configurable scoring criteria) ---
    WEIGHT_SEMANTIC: float = 0.35
    WEIGHT_SKILLS: float = 0.35
    WEIGHT_EXPERIENCE: float = 0.20
    WEIGHT_EDUCATION: float = 0.10

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
