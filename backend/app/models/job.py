import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, Text, Float, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class Job(Base):
    """A job posting created by a recruiter, with structured requirements."""
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recruiter_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    department = Column(String, nullable=True)
    location = Column(String, nullable=True)
    seniority = Column(String, nullable=True)  # junior/mid/senior/lead

    required_skills = Column(JSON, default=list)       # ["python", "fastapi", ...]
    preferred_skills = Column(JSON, default=list)
    min_experience_years = Column(Float, default=0)
    required_education = Column(String, nullable=True)  # e.g. "Bachelor's in CS"
    required_certifications = Column(JSON, default=list)

    # Configurable scoring criteria per job (overrides global defaults if set)
    scoring_weights = Column(JSON, default=dict)

    status = Column(String, default="open")  # open/closed/archived
    created_at = Column(DateTime, default=datetime.utcnow)

    recruiter = relationship("User")
    candidates = relationship("Candidate", back_populates="job", cascade="all, delete-orphan")
