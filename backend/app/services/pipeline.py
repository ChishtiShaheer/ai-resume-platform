"""
End-to-end per-candidate processing pipeline, run as a background task
after upload so the API response returns instantly even for large
batches (batch processing requirement).

Steps: parse text -> (OCR fallback) -> structured extraction -> scoring
-> AI summary -> re-rank all candidates for the job -> index into the
vector store for the recruiter AI assistant.
"""
import logging
from datetime import datetime

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.candidate import Candidate
from app.models.job import Job
from app.services import extraction_service, llm_service, resume_parser, scoring_service, vector_store

logger = logging.getLogger(__name__)


def process_candidate(candidate_id: str) -> None:
    db: Session = SessionLocal()
    try:
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if not candidate:
            return
        job = db.query(Job).filter(Job.id == candidate.job_id).first()

        try:
            parsed = resume_parser.parse_resume(candidate.stored_path, candidate.file_type)
            candidate.raw_text = parsed.text
            candidate.used_ocr = "yes" if parsed.used_ocr else "no"

            if not parsed.text or len(parsed.text.strip()) < 20:
                candidate.status = "failed"
                candidate.processing_error = (
                    "Could not extract readable text from this file, even after OCR. "
                    "The file may be corrupted, password-protected, or a low-quality scan."
                )
                db.commit()
                return

            profile = extraction_service.extract_structured_profile(parsed.text)
            profile["raw_text"] = parsed.text

            candidate.full_name = profile.get("full_name") or candidate.original_filename
            candidate.email = profile.get("email")
            candidate.phone = profile.get("phone")
            candidate.skills = profile.get("skills", [])
            candidate.education = profile.get("education", [])
            candidate.experience = profile.get("experience", [])
            candidate.certifications = profile.get("certifications", [])
            candidate.total_experience_years = profile.get("total_experience_years", 0)

            score_result = scoring_service.score_candidate(profile, job)
            candidate.overall_score = score_result["overall_score"]
            candidate.semantic_score = score_result["semantic_score"]
            candidate.skill_score = score_result["skill_score"]
            candidate.experience_score = score_result["experience_score"]
            candidate.education_score = score_result["education_score"]
            candidate.matched_skills = score_result["matched_skills"]
            candidate.missing_skills = score_result["missing_skills"]
            candidate.score_breakdown = score_result["score_breakdown"]

            candidate.summary = llm_service.generate_candidate_summary(
                {
                    "full_name": candidate.full_name,
                    "skills": candidate.skills,
                    "total_experience_years": candidate.total_experience_years,
                    "matched_skills": candidate.matched_skills,
                    "missing_skills": candidate.missing_skills,
                },
                {"title": job.title, "required_skills": job.required_skills},
            )

            candidate.status = "processed"
            candidate.processed_at = datetime.utcnow()

            vector_store.index_document(
                doc_id=str(candidate.id),
                text=f"Candidate {candidate.full_name} — skills: {', '.join(candidate.skills)}. "
                     f"Experience: {candidate.total_experience_years} yrs. Summary: {candidate.summary}",
                job_id=str(job.id),
                metadata={"type": "candidate", "name": candidate.full_name or ""},
            )

        except Exception as e:
            logger.exception("Failed to process candidate %s", candidate_id)
            candidate.status = "failed"
            candidate.processing_error = str(e)

        db.commit()

        # Re-rank every processed candidate for this job
        all_candidates = db.query(Candidate).filter(
            Candidate.job_id == candidate.job_id, Candidate.status == "processed"
        ).all()
        scoring_service.rank_candidates(all_candidates)
        db.commit()
    finally:
        db.close()


def index_job(job_id: str) -> None:
    db: Session = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            vector_store.index_document(
                doc_id=f"job-{job.id}",
                text=f"Job: {job.title}. Description: {job.description}. "
                     f"Required skills: {', '.join(job.required_skills or [])}.",
                job_id=str(job.id),
                metadata={"type": "job"},
            )
    finally:
        db.close()
