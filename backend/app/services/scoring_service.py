"""
Core scoring engine: compares a candidate's extracted profile against a
job's requirements and produces a transparent, weighted relevance score.

Design goal (per the "expected system behaviour" spec): the recruiter
should be able to inspect *why* a candidate got their score, not just
see a number. Every sub-score returns its own explanation in
`score_breakdown`.
"""
from difflib import SequenceMatcher
from typing import Any, Dict, List, Tuple

from app.core.config import settings
from app.services.embedding_service import semantic_similarity

FUZZY_MATCH_THRESHOLD = 0.82  # e.g. "react.js" ~ "react"


def _fuzzy_equal(a: str, b: str) -> bool:
    if a == b:
        return True
    return SequenceMatcher(None, a, b).ratio() >= FUZZY_MATCH_THRESHOLD


def match_skills(candidate_skills: List[str], required_skills: List[str]) -> Tuple[List[str], List[str]]:
    """Returns (matched, missing) using exact + fuzzy matching so minor
    phrasing differences (e.g. 'nodejs' vs 'node.js') don't unfairly
    penalize a candidate."""
    candidate_skills = [s.lower().strip() for s in candidate_skills]
    matched, missing = [], []
    for req in required_skills:
        req_l = req.lower().strip()
        if any(_fuzzy_equal(req_l, c) for c in candidate_skills):
            matched.append(req)
        else:
            missing.append(req)
    return matched, missing


def score_skill_match(candidate_skills: List[str], job) -> Dict[str, Any]:
    required = job.required_skills or []
    preferred = job.preferred_skills or []

    matched_required, missing_required = match_skills(candidate_skills, required)
    matched_preferred, _ = match_skills(candidate_skills, preferred)

    if not required and not preferred:
        return {"score": 100.0, "matched": [], "missing": [], "explanation": "No specific skills required."}

    required_score = (len(matched_required) / len(required) * 100) if required else 100.0
    preferred_bonus = (len(matched_preferred) / len(preferred) * 10) if preferred else 0.0
    score = min(100.0, required_score + preferred_bonus)

    return {
        "score": round(score, 2),
        "matched": matched_required + [s for s in matched_preferred if s not in matched_required],
        "missing": missing_required,
        "explanation": (
            f"Matched {len(matched_required)}/{len(required)} required skills"
            + (f" and {len(matched_preferred)}/{len(preferred)} preferred skills." if preferred else ".")
        ),
    }


def score_experience(candidate_years: float, job) -> Dict[str, Any]:
    required_years = job.min_experience_years or 0
    if required_years <= 0:
        return {"score": 100.0, "explanation": "No minimum experience specified."}
    if candidate_years >= required_years:
        # small bonus for exceeding requirement, capped
        bonus = min(15.0, (candidate_years - required_years) * 2)
        score = min(100.0, 85.0 + bonus)
    else:
        # linear penalty for falling short
        ratio = candidate_years / required_years
        score = round(ratio * 85.0, 2)
    return {
        "score": round(score, 2),
        "explanation": f"Candidate has {candidate_years} yrs vs. {required_years} yrs required.",
    }


def score_education(candidate_education: List[Dict[str, Any]], job) -> Dict[str, Any]:
    required = (job.required_education or "").lower().strip()
    if not required:
        return {"score": 100.0, "explanation": "No specific education requirement."}

    degree_rank = {"phd": 4, "master": 3, "mba": 3, "bachelor": 2, "associate": 1}

    def rank_of(text: str) -> int:
        text = text.lower()
        for key, rank in degree_rank.items():
            if key in text:
                return rank
        return 0

    required_rank = rank_of(required)
    candidate_ranks = [rank_of(e.get("degree", "")) for e in candidate_education]
    best_rank = max(candidate_ranks, default=0)

    if best_rank >= required_rank and required_rank > 0:
        score = 100.0
    elif best_rank > 0:
        score = round((best_rank / max(required_rank, 1)) * 80, 2)
    else:
        score = 20.0  # some credit — education isn't always decisive
    return {
        "score": score,
        "explanation": f"Highest detected education level rank {best_rank} vs required rank {required_rank} ('{job.required_education}').",
    }


def get_weights(job) -> Dict[str, float]:
    defaults = {
        "semantic": settings.WEIGHT_SEMANTIC,
        "skills": settings.WEIGHT_SKILLS,
        "experience": settings.WEIGHT_EXPERIENCE,
        "education": settings.WEIGHT_EDUCATION,
    }
    overrides = job.scoring_weights or {}
    merged = {**defaults, **{k: v for k, v in overrides.items() if v is not None}}
    total = sum(merged.values()) or 1.0
    return {k: v / total for k, v in merged.items()}  # normalize to sum=1


def score_candidate(candidate_profile: Dict[str, Any], job) -> Dict[str, Any]:
    """Main entry point. candidate_profile is the dict produced by
    extraction_service.extract_structured_profile, plus 'raw_text'."""
    weights = get_weights(job)

    semantic = semantic_similarity(job.description, candidate_profile.get("raw_text", ""))
    skills_result = score_skill_match(candidate_profile.get("skills", []), job)
    experience_result = score_experience(candidate_profile.get("total_experience_years", 0), job)
    education_result = score_education(candidate_profile.get("education", []), job)

    overall = (
        semantic * weights["semantic"]
        + skills_result["score"] * weights["skills"]
        + experience_result["score"] * weights["experience"]
        + education_result["score"] * weights["education"]
    )

    breakdown = {
        "weights_used": weights,
        "semantic": {"score": semantic, "explanation": "Overall contextual similarity between resume and job description."},
        "skills": skills_result,
        "experience": experience_result,
        "education": education_result,
    }

    return {
        "overall_score": round(overall, 2),
        "semantic_score": semantic,
        "skill_score": skills_result["score"],
        "experience_score": experience_result["score"],
        "education_score": education_result["score"],
        "matched_skills": skills_result["matched"],
        "missing_skills": skills_result["missing"],
        "score_breakdown": breakdown,
    }


def rank_candidates(candidates: List) -> None:
    """Mutates candidate.rank in place, highest overall_score first."""
    ordered = sorted(candidates, key=lambda c: c.overall_score or 0, reverse=True)
    for i, c in enumerate(ordered, start=1):
        c.rank = i


def check_scoring_consistency(candidates: List, similarity_threshold: float = 0.9, score_gap_flag: float = 20.0) -> List[Dict[str, Any]]:
    """Screening-consistency check (advanced requirement): flags pairs of
    candidates with very similar skill sets but a large score gap, which
    usually indicates the gap is being driven by experience/education
    rather than a scoring bug — surfaced so a recruiter can sanity-check it."""
    flags = []
    for i in range(len(candidates)):
        for j in range(i + 1, len(candidates)):
            a, b = candidates[i], candidates[j]
            set_a, set_b = set(a.skills or []), set(b.skills or [])
            if not set_a or not set_b:
                continue
            jaccard = len(set_a & set_b) / len(set_a | set_b)
            gap = abs((a.overall_score or 0) - (b.overall_score or 0))
            if jaccard >= similarity_threshold and gap >= score_gap_flag:
                flags.append({
                    "candidate_a": str(a.id),
                    "candidate_b": str(b.id),
                    "skill_similarity": round(jaccard, 2),
                    "score_gap": round(gap, 2),
                    "note": "Very similar skill sets but a large score gap — verify experience/education inputs.",
                })
    return flags
