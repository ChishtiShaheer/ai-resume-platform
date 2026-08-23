"""
Recruitment analytics dashboard: cross-job aggregate stats for the
logged-in recruiter (pipeline volume, average scores, top skills gaps,
funnel breakdown by candidate status).
"""
from collections import Counter
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/overview")
def overview(job_id: Optional[UUID] = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    jobs_query = db.query(Job).filter(Job.recruiter_id == user.id)
    if job_id:
        jobs_query = jobs_query.filter(Job.id == job_id)
    jobs = jobs_query.all()
    job_ids = [j.id for j in jobs]

    candidates = db.query(Candidate).filter(Candidate.job_id.in_(job_ids)).all() if job_ids else []
    processed = [c for c in candidates if c.status == "processed"]

    status_counts = Counter(c.status for c in candidates)

    avg_score = round(sum(c.overall_score for c in processed) / len(processed), 2) if processed else 0

    missing_skill_counter = Counter()
    for c in processed:
        missing_skill_counter.update(c.missing_skills or [])
    top_missing_skills = missing_skill_counter.most_common(10)

    score_buckets = {"0-40": 0, "40-60": 0, "60-75": 0, "75-90": 0, "90-100": 0}
    for c in processed:
        s = c.overall_score or 0
        if s < 40:
            score_buckets["0-40"] += 1
        elif s < 60:
            score_buckets["40-60"] += 1
        elif s < 75:
            score_buckets["60-75"] += 1
        elif s < 90:
            score_buckets["75-90"] += 1
        else:
            score_buckets["90-100"] += 1

    return {
        "total_jobs": len(jobs),
        "open_jobs": len([j for j in jobs if j.status == "open"]),
        "total_candidates": len(candidates),
        "average_overall_score": avg_score,
        "status_breakdown": status_counts,
        "score_distribution": score_buckets,
        "top_missing_skills": [{"skill": s, "count": n} for s, n in top_missing_skills],
        "shortlisted_count": status_counts.get("shortlisted", 0),
        "rejected_count": status_counts.get("rejected", 0),
        "failed_count": status_counts.get("failed", 0),
    }


@router.get("/jobs/{job_id}/history")
def job_history(job_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Candidate & job history: full timeline of candidates processed for a job."""
    job = db.query(Job).filter(Job.id == job_id, Job.recruiter_id == user.id).first()
    if not job:
        return {"error": "Job not found."}
    candidates = db.query(Candidate).filter(Candidate.job_id == job_id).order_by(Candidate.created_at).all()
    return {
        "job": {"id": str(job.id), "title": job.title, "created_at": job.created_at},
        "timeline": [
            {
                "candidate_id": str(c.id),
                "filename": c.original_filename,
                "status": c.status,
                "overall_score": c.overall_score,
                "uploaded_at": c.created_at,
                "processed_at": c.processed_at,
            }
            for c in candidates
        ],
    }
