"""
Resume upload endpoint. Accepts multiple PDF/DOCX files for a job in one
request (batch processing), saves them to disk, creates a pending
Candidate row per file, and kicks off background processing so the
recruiter isn't blocked waiting on parsing/OCR/scoring for large batches.
"""
import os
import uuid
from pathlib import Path
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.user import User
from app.services.pipeline import process_candidate, index_job

router = APIRouter(prefix="/jobs/{job_id}/resumes", tags=["Resumes"])


def _get_owned_job(job_id, db: Session, user: User) -> Job:
    job = db.query(Job).filter(Job.id == job_id, Job.recruiter_id == user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


@router.post("", status_code=202)
async def upload_resumes(
    job_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    job = _get_owned_job(job_id, db, user)

    storage_dir = Path(settings.STORAGE_DIR) / str(job.id)
    storage_dir.mkdir(parents=True, exist_ok=True)

    created = []
    rejected = []

    for upload in files:
        ext = Path(upload.filename).suffix.lower()
        if ext not in settings.ALLOWED_EXTENSIONS:
            rejected.append({"filename": upload.filename, "reason": f"Unsupported file type '{ext}'."})
            continue

        contents = await upload.read()
        size_mb = len(contents) / (1024 * 1024)
        if size_mb > settings.MAX_UPLOAD_MB:
            rejected.append({"filename": upload.filename, "reason": f"File exceeds {settings.MAX_UPLOAD_MB}MB limit."})
            continue

        unique_name = f"{uuid.uuid4()}{ext}"
        dest_path = storage_dir / unique_name
        with open(dest_path, "wb") as f:
            f.write(contents)

        candidate = Candidate(
            job_id=job.id,
            original_filename=upload.filename,
            stored_path=str(dest_path),
            file_type=ext.lstrip("."),
            status="pending",
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)
        created.append(candidate)

        background_tasks.add_task(process_candidate, str(candidate.id))

    background_tasks.add_task(index_job, str(job.id))

    return {
        "job_id": str(job.id),
        "accepted": [{"candidate_id": str(c.id), "filename": c.original_filename} for c in created],
        "rejected": rejected,
        "message": f"{len(created)} resume(s) accepted and queued for processing.",
    }
