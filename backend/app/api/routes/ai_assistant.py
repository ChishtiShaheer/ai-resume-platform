"""
Recruiter AI assistant: free-text Q&A over indexed job/candidate data
(retrieval-augmented via vector_store, generation via llm_service).
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.ai import AssistantQueryRequest, AssistantQueryResponse
from app.services import llm_service, vector_store

router = APIRouter(prefix="/assistant", tags=["AI Assistant"])


@router.post("/query", response_model=AssistantQueryResponse)
def query_assistant(payload: AssistantQueryRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    context_chunks = vector_store.search(payload.query, job_id=payload.job_id, top_k=6)
    answer = llm_service.answer_recruiter_query(payload.query, context_chunks)
    return AssistantQueryResponse(answer=answer, sources=context_chunks[:3])
