"""
Exports shortlisted/ranked candidates to CSV or Excel for a job.
"""
import io
from typing import List

import pandas as pd

from app.models.candidate import Candidate


def _to_dataframe(candidates: List[Candidate]) -> pd.DataFrame:
    rows = []
    for c in candidates:
        rows.append({
            "Rank": c.rank,
            "Name": c.full_name,
            "Email": c.email,
            "Phone": c.phone,
            "Overall Score": c.overall_score,
            "Skill Score": c.skill_score,
            "Experience Score": c.experience_score,
            "Education Score": c.education_score,
            "Semantic Score": c.semantic_score,
            "Total Experience (yrs)": c.total_experience_years,
            "Matched Skills": ", ".join(c.matched_skills or []),
            "Missing Skills": ", ".join(c.missing_skills or []),
            "Status": c.status,
            "Resume File": c.original_filename,
        })
    df = pd.DataFrame(rows)
    if not df.empty:
        df = df.sort_values("Rank", na_position="last")
    return df


def export_csv(candidates: List[Candidate]) -> bytes:
    df = _to_dataframe(candidates)
    buffer = io.StringIO()
    df.to_csv(buffer, index=False)
    return buffer.getvalue().encode("utf-8")


def export_xlsx(candidates: List[Candidate]) -> bytes:
    df = _to_dataframe(candidates)
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Shortlist")
    return buffer.getvalue()
