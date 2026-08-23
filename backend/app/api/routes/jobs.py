from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.user import User
from app.schemas.job import JobCreate, JobOut, JobUpdate

router = APIRouter(prefix="/jobs", tags=["Jobs"])


def _to_out(job: Job, db: Session) -> JobOut:
    count = db.query(Candidate).filter(Candidate.job_id == job.id).count()
    out = JobOut.model_validate(job)
    out.candidate_count = count
    return out


@router.post("", response_model=JobOut, status_code=201)
def create_job(payload: JobCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    job = Job(recruiter_id=user.id, **payload.model_dump())
    db.add(job)
    db.commit()
    db.refresh(job)
    return _to_out(job, db)


@router.get("", response_model=List[JobOut])
def list_jobs(
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Job).filter(Job.recruiter_id == user.id)
    if status_filter:
        query = query.filter(Job.status == status_filter)
    if search:
        query = query.filter(Job.title.ilike(f"%{search}%"))
    jobs = query.order_by(Job.created_at.desc()).all()
    return [_to_out(j, db) for j in jobs]


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    job = db.query(Job).filter(Job.id == job_id, Job.recruiter_id == user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return _to_out(job, db)


@router.patch("/{job_id}", response_model=JobOut)
def update_job(job_id: UUID, payload: JobUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    job = db.query(Job).filter(Job.id == job_id, Job.recruiter_id == user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(job, field, value)
    db.commit()
    db.refresh(job)
    return _to_out(job, db)


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    job = db.query(Job).filter(Job.id == job_id, Job.recruiter_id == user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    db.delete(job)
    db.commit()
