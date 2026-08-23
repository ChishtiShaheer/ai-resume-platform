"""
Turns raw resume text into structured fields: contact info, skills,
education, experience (with total years), and certifications.

Default mode is rule-based (regex + skills taxonomy matching) so the
pipeline works fully offline with zero API keys. If an LLM provider is
configured (see llm_service.py), `extract_with_llm` is used instead and
falls back to the rule-based extractor on any failure — extraction never
hard-fails a resume.
"""
import json
import re
from pathlib import Path
from typing import Any, Dict, List

from app.services import llm_service

_TAXONOMY_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "skills_taxonomy.json"
with open(_TAXONOMY_PATH) as f:
    _TAXONOMY: Dict[str, List[str]] = json.load(f)

_ALL_SKILLS = sorted({s.lower() for skills in _TAXONOMY.values() for s in skills}, key=len, reverse=True)

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
_PHONE_RE = re.compile(r"(\+?\d{1,3}[\s.-]?)?(\(?\d{2,4}\)?[\s.-]?){2,4}\d{3,4}")
_YEAR_RANGE_RE = re.compile(
    r"(?P<start>(19|20)\d{2})\s*(?:-|–|to)\s*(?P<end>(19|20)\d{2}|present|current)",
    re.IGNORECASE,
)
_DEGREE_RE = re.compile(
    r"\b(Bachelor(?:'s)?|Master(?:'s)?|B\.?Sc\.?|M\.?Sc\.?|B\.?Tech|M\.?Tech|BS|MS|MBA|PhD|Ph\.D\.?|Associate(?:'s)?)\b"
    r"[^\n,;]{0,60}",
    re.IGNORECASE,
)
_CERT_KEYWORDS = [
    "certified", "certification", "certificate", "aws certified", "pmp",
    "scrum master", "azure certified", "google certified", "comptia",
]

SECTION_HEADERS = ["experience", "education", "skills", "certifications", "projects", "summary"]


def _guess_name(text: str) -> str | None:
    """Heuristic: the first non-empty line that looks like a person's name
    (2-4 capitalized words, no digits/emails/section-header words)."""
    for line in text.splitlines()[:8]:
        line = line.strip()
        if not line or _EMAIL_RE.search(line) or any(ch.isdigit() for ch in line):
            continue
        words = line.split()
        if 1 < len(words) <= 4 and all(w[0].isupper() for w in words if w.isalpha()):
            lowered = line.lower()
            if not any(h in lowered for h in SECTION_HEADERS):
                return line
    return None


def _extract_contact(text: str) -> Dict[str, str | None]:
    email_match = _EMAIL_RE.search(text)
    phone_match = _PHONE_RE.search(text)
    return {
        "full_name": _guess_name(text),
        "email": email_match.group(0) if email_match else None,
        "phone": phone_match.group(0).strip() if phone_match else None,
    }


def _extract_skills(text: str) -> List[str]:
    lowered = text.lower()
    found = set()
    for skill in _ALL_SKILLS:
        # word-boundary match so "r" or "go" don't match inside other words
        pattern = r"(?<![a-zA-Z0-9])" + re.escape(skill) + r"(?![a-zA-Z0-9])"
        if re.search(pattern, lowered):
            found.add(skill)
    return sorted(found)


def _extract_education(text: str) -> List[Dict[str, Any]]:
    results = []
    for match in _DEGREE_RE.finditer(text):
        snippet = match.group(0).strip()
        year_match = re.search(r"(19|20)\d{2}", text[match.end(): match.end() + 60])
        results.append({
            "degree": snippet,
            "year": year_match.group(0) if year_match else None,
        })
    # de-duplicate by degree text
    seen = set()
    deduped = []
    for r in results:
        if r["degree"].lower() not in seen:
            seen.add(r["degree"].lower())
            deduped.append(r)
    return deduped[:6]


def _extract_experience(text: str) -> (List[Dict[str, Any]], float):
    entries = []
    total_years = 0.0
    for match in _YEAR_RANGE_RE.finditer(text):
        start = int(match.group("start"))
        end_raw = match.group("end").lower()
        end = 2026 if end_raw in ("present", "current") else int(end_raw)
        span = max(0, end - start)
        total_years += span
        # grab a bit of surrounding context as the role description
        ctx_start = max(0, match.start() - 80)
        context = text[ctx_start:match.start()].strip().splitlines()
        title_guess = context[-1].strip() if context else ""
        entries.append({
            "period": match.group(0),
            "years": span,
            "context": title_guess[:120],
        })
    # avoid wildly overcounting overlapping ranges; cap at a sane ceiling
    total_years = min(total_years, 45)
    return entries[:10], round(total_years, 1)


def _extract_certifications(text: str) -> List[str]:
    lines = text.splitlines()
    found = []
    for line in lines:
        lowered = line.lower()
        if any(kw in lowered for kw in _CERT_KEYWORDS):
            cleaned = line.strip(" -•\t")
            if 3 < len(cleaned) < 140:
                found.append(cleaned)
    return found[:10]


def extract_rule_based(text: str) -> Dict[str, Any]:
    contact = _extract_contact(text)
    skills = _extract_skills(text)
    education = _extract_education(text)
    experience, total_years = _extract_experience(text)
    certifications = _extract_certifications(text)
    return {
        **contact,
        "skills": skills,
        "education": education,
        "experience": experience,
        "certifications": certifications,
        "total_experience_years": total_years,
    }


def extract_structured_profile(text: str) -> Dict[str, Any]:
    """Main entry point used by the resume-processing pipeline.
    Tries the LLM extractor (if configured) and always falls back to the
    deterministic rule-based extractor so processing never fails outright."""
    if llm_service.is_llm_configured():
        try:
            llm_result = llm_service.extract_profile_with_llm(text)
            if llm_result:
                # Merge: prefer LLM's structured fields, but keep rule-based
                # skills too (union) since taxonomy matching catches things
                # phrased differently than the LLM chose to list.
                rule_based = extract_rule_based(text)
                merged_skills = sorted(set(llm_result.get("skills", [])) | set(rule_based["skills"]))
                merged = {**rule_based, **llm_result, "skills": merged_skills}
                return merged
        except Exception:
            pass  # fall through to rule-based
    return extract_rule_based(text)
