from fastapi import APIRouter

from app.api.routes import ai_assistant, analytics, auth, candidates, jobs, resumes

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(jobs.router)
api_router.include_router(resumes.router)
api_router.include_router(candidates.router)
api_router.include_router(analytics.router)
api_router.include_router(ai_assistant.router)
