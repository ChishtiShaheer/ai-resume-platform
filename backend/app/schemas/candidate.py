from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel


class CandidateListItem(BaseModel):
    id: UUID
    full_name: Optional[str]
    email: Optional[str]
    overall_score: float
    skill_score: float
    experience_score: float
    education_score: float
    semantic_score: float
    matched_skills: List[str] = []
    missing_skills: List[str] = []
    total_experience_years: float
    status: str
    rank: Optional[int]

    class Config:
        from_attributes = True


class CandidateDetail(CandidateListItem):
    original_filename: str
    education: List[Dict[str, Any]] = []
    experience: List[Dict[str, Any]] = []
    certifications: List[str] = []
    skills: List[str] = []
    summary: Optional[str] = None
    score_breakdown: Dict[str, Any] = {}
    interview_questions: List[str] = []
    used_ocr: str = "no"
    created_at: datetime

    class Config:
        from_attributes = True


class CandidateCompareRequest(BaseModel):
    candidate_ids: List[UUID]


class ScoringWeightsUpdate(BaseModel):
    semantic: Optional[float] = None
    skills: Optional[float] = None
    experience: Optional[float] = None
    education: Optional[float] = None
