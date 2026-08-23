import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered recruitment platform: resume screening, semantic candidate "
                 "matching, transparent scoring, and ranking.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.on_event("startup")
def on_startup():
    # For a hackathon/MVP timeline we create tables directly from the models.
    # Swap this for `alembic upgrade head` in production (migrations are
    # scaffolded under /alembic).
    Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {"status": "ok", "service": settings.APP_NAME}


@app.get("/health")
def health():
    return {"status": "healthy"}
