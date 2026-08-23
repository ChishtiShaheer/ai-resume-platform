import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, Text, Float, ForeignKey, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class Candidate(Base):
    """A candidate created from one uploaded resume, scoped to a single job."""
    __tablename__ = "candidates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)

    # File + raw extraction
    original_filename = Column(String, nullable=False)
    stored_path = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # pdf/docx
    raw_text = Column(Text, nullable=True)
    used_ocr = Column(String, default="no")  # "yes"/"no" — track for transparency

    # Parsed identity
    full_name = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)

    # Structured extraction
    skills = Column(JSON, default=list)
    education = Column(JSON, default=list)          # [{degree, institution, year}]
    experience = Column(JSON, default=list)          # [{title, company, years, description}]
    certifications = Column(JSON, default=list)
    total_experience_years = Column(Float, default=0)

    # Scoring output
    overall_score = Column(Float, default=0)
    semantic_score = Column(Float, default=0)
    skill_score = Column(Float, default=0)
    experience_score = Column(Float, default=0)
    education_score = Column(Float, default=0)
    matched_skills = Column(JSON, default=list)
    missing_skills = Column(JSON, default=list)
    score_breakdown = Column(JSON, default=dict)  # free-form explanation for transparency

    summary = Column(Text, nullable=True)          # AI/template generated summary
    interview_questions = Column(JSON, default=list)

    status = Column(String, default="pending")  # pending/processed/shortlisted/rejected/failed
    processing_error = Column(Text, nullable=True)

    rank = Column(Integer, nullable=True)  # computed rank within job

    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)

    job = relationship("Job", back_populates="candidates")
