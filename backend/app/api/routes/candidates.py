"""
Candidate listing/search/filtering, detail view, ranking status, export,
comparison, interview-question generation, and scoring-consistency checks.
"""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.user import User
from app.schemas.ai import InterviewQuestionRequest
from app.schemas.candidate import (
    CandidateCompareRequest, CandidateDetail, CandidateListItem, ScoringWeightsUpdate,
)
from app.services import export_service, llm_service, scoring_service

router = APIRouter(tags=["Candidates"])


def _owned_job(job_id, db: Session, user: User) -> Job:
    job = db.query(Job).filter(Job.id == job_id, Job.recruiter_id == user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


@router.get("/jobs/{job_id}/candidates", response_model=List[CandidateListItem])
def list_candidates(
    job_id: uuid.UUID,
    search: Optional[str] = None,
    min_score: Optional[float] = None,
    status_filter: Optional[str] = None,
    skill: Optional[str] = None,
    sort_by: str = "rank",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _owned_job(job_id, db, user)
    query = db.query(Candidate).filter(Candidate.job_id == job_id)

    if status_filter:
        query = query.filter(Candidate.status == status_filter)
    if min_score is not None:
        query = query.filter(Candidate.overall_score >= min_score)
    if search:
        like = f"%{search}%"
        query = query.filter((Candidate.full_name.ilike(like)) | (Candidate.email.ilike(like)))

    candidates = query.all()

    if skill:
        skill_l = skill.lower()
        candidates = [c for c in candidates if any(skill_l in s.lower() for s in (c.skills or []))]

    if sort_by == "rank":
        candidates.sort(key=lambda c: (c.rank is None, c.rank))
    elif sort_by == "score":
        candidates.sort(key=lambda c: c.overall_score or 0, reverse=True)
    elif sort_by == "experience":
        candidates.sort(key=lambda c: c.total_experience_years or 0, reverse=True)
    elif sort_by == "name":
        candidates.sort(key=lambda c: (c.full_name or "").lower())

    return candidates


@router.get("/candidates/{candidate_id}", response_model=CandidateDetail)
def get_candidate(candidate_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    candidate = (
        db.query(Candidate).join(Job).filter(Candidate.id == candidate_id, Job.recruiter_id == user.id).first()
    )
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    return candidate


@router.patch("/candidates/{candidate_id}/status")
def update_candidate_status(candidate_id: uuid.UUID, new_status: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    candidate = (
        db.query(Candidate).join(Job).filter(Candidate.id == candidate_id, Job.recruiter_id == user.id).first()
    )
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    if new_status not in ("shortlisted", "rejected", "processed", "pending"):
        raise HTTPException(status_code=400, detail="Invalid status value.")
    candidate.status = new_status
    db.commit()
    return {"id": str(candidate.id), "status": candidate.status}


@router.post("/jobs/{job_id}/candidates/export")
def export_candidates(job_id: uuid.UUID, format: str = "csv", db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _owned_job(job_id, db, user)
    candidates = db.query(Candidate).filter(
        Candidate.job_id == job_id, Candidate.status.in_(["processed", "shortlisted"])
    ).order_by(Candidate.rank).all()

    if format == "xlsx":
        content = export_service.export_xlsx(candidates)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "shortlist.xlsx"
    else:
        content = export_service.export_csv(candidates)
        media_type = "text/csv"
        filename = "shortlist.csv"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/jobs/{job_id}/candidates/compare", response_model=List[CandidateDetail])
def compare_candidates(job_id: uuid.UUID, payload: CandidateCompareRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _owned_job(job_id, db, user)
    candidates = db.query(Candidate).filter(
        Candidate.job_id == job_id, Candidate.id.in_(payload.candidate_ids)
    ).all()
    if len(candidates) < 2:
        raise HTTPException(status_code=400, detail="Select at least 2 candidates to compare.")
    return candidates


@router.get("/jobs/{job_id}/candidates/consistency-check")
def consistency_check(job_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _owned_job(job_id, db, user)
    candidates = db.query(Candidate).filter(
        Candidate.job_id == job_id, Candidate.status == "processed"
    ).all()
    flags = scoring_service.check_scoring_consistency(candidates)
    return {"job_id": str(job_id), "flags": flags, "checked_candidates": len(candidates)}


@router.patch("/jobs/{job_id}/scoring-weights")
def update_scoring_weights(job_id: uuid.UUID, payload: ScoringWeightsUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Configurable scoring criteria: overrides the global weights for this
    job only, then re-scores + re-ranks every already-processed candidate."""
    job = _owned_job(job_id, db, user)
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    job.scoring_weights = {**(job.scoring_weights or {}), **updates}
    db.commit()

    candidates = db.query(Candidate).filter(Candidate.job_id == job_id, Candidate.status == "processed").all()
    for c in candidates:
        profile = {
            "skills": c.skills, "education": c.education,
            "total_experience_years": c.total_experience_years, "raw_text": c.raw_text or "",
        }
        result = scoring_service.score_candidate(profile, job)
        c.overall_score = result["overall_score"]
        c.semantic_score = result["semantic_score"]
        c.skill_score = result["skill_score"]
        c.experience_score = result["experience_score"]
        c.education_score = result["education_score"]
        c.matched_skills = result["matched_skills"]
        c.missing_skills = result["missing_skills"]
        c.score_breakdown = result["score_breakdown"]
    scoring_service.rank_candidates(candidates)
    db.commit()
    return {"job_id": str(job_id), "scoring_weights": job.scoring_weights, "rescored_count": len(candidates)}


@router.post("/candidates/{candidate_id}/interview-questions")
def generate_interview_questions(candidate_id: uuid.UUID, payload: InterviewQuestionRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    candidate = (
        db.query(Candidate).join(Job).filter(Candidate.id == candidate_id, Job.recruiter_id == user.id).first()
    )
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    job = db.query(Job).filter(Job.id == candidate.job_id).first()

    questions = llm_service.generate_interview_questions(
        {"matched_skills": candidate.matched_skills, "missing_skills": candidate.missing_skills},
        {"title": job.title},
        n=payload.num_questions,
    )
    candidate.interview_questions = questions
    db.commit()
    return {"candidate_id": str(candidate_id), "questions": questions}
