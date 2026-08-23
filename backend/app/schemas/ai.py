from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel


class InterviewQuestionRequest(BaseModel):
    candidate_id: UUID
    num_questions: int = 5


class AssistantQueryRequest(BaseModel):
    query: str
    job_id: Optional[UUID] = None


class AssistantQueryResponse(BaseModel):
    answer: str
    sources: List[str] = []
