"""
Thin abstraction over an LLM provider (OpenAI or Gemini), used for:
  - structured profile extraction (optional enhancement over rule-based)
  - candidate summary generation
  - AI-generated interview questions
  - recruiter AI assistant chat

Every public function here degrades gracefully: if no API key is
configured (LLM_PROVIDER="none" or key missing), callers should use the
template-based fallbacks defined in this module instead. This means the
whole platform is fully demoable with zero API keys, and instantly
upgrades once you drop in your own OPENAI_API_KEY or GEMINI_API_KEY.
"""
import json
import logging
from typing import Any, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


def is_llm_configured() -> bool:
    if settings.LLM_PROVIDER == "openai":
        return bool(settings.OPENAI_API_KEY)
    if settings.LLM_PROVIDER == "gemini":
        return bool(settings.GEMINI_API_KEY)
    return False


def _call_openai(prompt: str, system: str = "You are a helpful recruitment assistant.") -> str:
    from openai import OpenAI
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}],
        temperature=0.3,
    )
    return response.choices[0].message.content or ""


def _call_gemini(prompt: str, system: str = "You are a helpful recruitment assistant.") -> str:
    import google.generativeai as genai
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(settings.GEMINI_MODEL, system_instruction=system)
    response = model.generate_content(prompt)
    return response.text or ""


def _call_llm(prompt: str, system: Optional[str] = None) -> str:
    kwargs = {"system": system} if system else {}
    if settings.LLM_PROVIDER == "openai":
        return _call_openai(prompt, **kwargs)
    if settings.LLM_PROVIDER == "gemini":
        return _call_gemini(prompt, **kwargs)
    raise RuntimeError("No LLM provider configured")


def _extract_json(text: str) -> Optional[dict]:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text.split("\n", 1)[-1] if text.lower().startswith("json") else text
    try:
        return json.loads(text)
    except Exception:
        # try to locate the outermost {...}
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end != -1:
            try:
                return json.loads(text[start:end + 1])
            except Exception:
                return None
    return None


# ---------------------------------------------------------------------------
# Structured extraction
# ---------------------------------------------------------------------------

def extract_profile_with_llm(resume_text: str) -> Optional[Dict[str, Any]]:
    prompt = f"""Extract structured information from this resume as strict JSON with keys:
full_name, email, phone, skills (list of strings, lowercase),
education (list of {{degree, institution, year}}),
experience (list of {{title, company, years, description}}),
certifications (list of strings), total_experience_years (number).
Return ONLY valid JSON, no commentary.

RESUME TEXT:
{resume_text[:6000]}
"""
    raw = _call_llm(prompt, system="You extract structured recruitment data as JSON only.")
    return _extract_json(raw)


# ---------------------------------------------------------------------------
# Candidate summary
# ---------------------------------------------------------------------------

def generate_candidate_summary(candidate: Dict[str, Any], job: Dict[str, Any]) -> str:
    if is_llm_configured():
        try:
            prompt = f"""Write a concise 3-4 sentence recruiter-facing summary of this candidate's
fit for the job below. Be specific and factual, mention concrete strengths and gaps.

JOB: {job.get('title')} — requires: {', '.join(job.get('required_skills', []))}
CANDIDATE SKILLS: {', '.join(candidate.get('skills', []))}
CANDIDATE EXPERIENCE (years): {candidate.get('total_experience_years')}
MATCHED SKILLS: {', '.join(candidate.get('matched_skills', []))}
MISSING SKILLS: {', '.join(candidate.get('missing_skills', []))}
"""
            return _call_llm(prompt).strip()
        except Exception as e:
            logger.warning("LLM summary generation failed, using template fallback: %s", e)
    return template_summary(candidate, job)


def template_summary(candidate: Dict[str, Any], job: Dict[str, Any]) -> str:
    matched = candidate.get("matched_skills", [])
    missing = candidate.get("missing_skills", [])
    years = candidate.get("total_experience_years", 0)
    name = candidate.get("full_name") or "This candidate"
    parts = [
        f"{name} has approximately {years} years of relevant experience and matches "
        f"{len(matched)} of {len(matched) + len(missing)} required skills for {job.get('title', 'this role')}."
    ]
    if matched:
        parts.append(f"Key matched skills: {', '.join(matched[:6])}.")
    if missing:
        parts.append(f"Notable gaps: {', '.join(missing[:6])}.")
    else:
        parts.append("No major required-skill gaps were detected.")
    return " ".join(parts)


# ---------------------------------------------------------------------------
# Interview questions
# ---------------------------------------------------------------------------

def generate_interview_questions(candidate: Dict[str, Any], job: Dict[str, Any], n: int = 5) -> List[str]:
    if is_llm_configured():
        try:
            prompt = f"""Generate {n} targeted interview questions for this candidate applying to
"{job.get('title')}". Focus on probing their missing/weak skills ({', '.join(candidate.get('missing_skills', []))})
and validating their claimed strengths ({', '.join(candidate.get('matched_skills', []))}).
Return ONLY a JSON array of strings, no commentary."""
            raw = _call_llm(prompt, system="You generate structured interview questions as a JSON array only.")
            parsed = _extract_json_array(raw)
            if parsed:
                return parsed[:n]
        except Exception as e:
            logger.warning("LLM interview-question generation failed, using template fallback: %s", e)
    return template_interview_questions(candidate, job, n)


def _extract_json_array(text: str) -> Optional[List[str]]:
    text = text.strip().strip("`")
    start, end = text.find("["), text.rfind("]")
    if start != -1 and end != -1:
        try:
            data = json.loads(text[start:end + 1])
            if isinstance(data, list):
                return [str(x) for x in data]
        except Exception:
            return None
    return None


def template_interview_questions(candidate: Dict[str, Any], job: Dict[str, Any], n: int = 5) -> List[str]:
    questions = []
    for skill in candidate.get("missing_skills", [])[:3]:
        questions.append(f"We didn't see strong evidence of {skill} on your resume — "
                          f"can you walk us through any experience you have with it?")
    for skill in candidate.get("matched_skills", [])[:3]:
        questions.append(f"Tell us about a challenging project where you used {skill}. "
                          f"What was your specific contribution?")
    questions.append(f"What interests you about the {job.get('title', 'role')} position specifically?")
    questions.append("Describe a time you had to learn a new tool or technology quickly for a project.")
    return questions[:n]


# ---------------------------------------------------------------------------
# Recruiter AI assistant (RAG-lite)
# ---------------------------------------------------------------------------

def answer_recruiter_query(query: str, context_chunks: List[str]) -> str:
    if is_llm_configured():
        try:
            context = "\n---\n".join(context_chunks[:8])
            prompt = f"""You are a recruiter's assistant. Using ONLY the context below (job and
candidate records), answer the recruiter's question concisely and factually.
If the context doesn't contain the answer, say so plainly.

CONTEXT:
{context}

QUESTION: {query}
"""
            return _call_llm(prompt).strip()
        except Exception as e:
            logger.warning("LLM assistant query failed, using template fallback: %s", e)
    if not context_chunks:
        return "I don't have enough indexed data yet to answer that — try processing some resumes first."
    return ("AI assistant is running in offline mode (no LLM key configured). "
            "Here's the most relevant matching context I found:\n\n" + "\n---\n".join(context_chunks[:3]))
