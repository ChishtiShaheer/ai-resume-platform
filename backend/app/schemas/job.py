from typing import Optional, List, Dict
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel


class JobBase(BaseModel):
    title: str
    description: str
    department: Optional[str] = None
    location: Optional[str] = None
    seniority: Optional[str] = None
    required_skills: List[str] = []
    preferred_skills: List[str] = []
    min_experience_years: float = 0
    required_education: Optional[str] = None
    required_certifications: List[str] = []
    scoring_weights: Optional[Dict[str, float]] = None


class JobCreate(JobBase):
    pass


class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    seniority: Optional[str] = None
    required_skills: Optional[List[str]] = None
    preferred_skills: Optional[List[str]] = None
    min_experience_years: Optional[float] = None
    required_education: Optional[str] = None
    required_certifications: Optional[List[str]] = None
    scoring_weights: Optional[Dict[str, float]] = None
    status: Optional[str] = None


class JobOut(JobBase):
    id: UUID
    status: str
    created_at: datetime
    candidate_count: int = 0

    class Config:
        from_attributes = True
