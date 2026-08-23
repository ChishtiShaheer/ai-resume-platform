import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, CandidateDetail } from "../api/client";
import { ScoreReadout, segmentsFromCandidate } from "../components/ScoreReadout";
import { SkillPill } from "../components/SkillPill";
import { Spinner } from "../components/Spinner";

export default function ComparePage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [params] = useSearchParams();
  const [candidates, setCandidates] = useState<CandidateDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const ids = (params.get("ids") || "").split(",").filter(Boolean);
      const { data } = await api.post<CandidateDetail[]>(`/jobs/${jobId}/candidates/compare`, { candidate_ids: ids });
      setCandidates(data);
      setLoading(false);
    })();
  }, [jobId, params]);

  if (loading) return <Spinner label="Loading comparison…" />;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <Link to={`/jobs/${jobId}`} className="text-sm text-slate hover:text-ink mb-4 inline-block">← Back to job</Link>
      <h1 className="text-2xl font-semibold text-ink mb-6">Candidate comparison</h1>
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${candidates.length}, minmax(0, 1fr))` }}>
        {candidates.map((c) => (
          <div key={c.id} className="card p-5">
            <h3 className="font-semibold text-ink mb-1">{c.full_name}</h3>
            <p className="text-xs text-slate mb-3">{c.email}</p>
            <ScoreReadout overall={c.overall_score} segments={segmentsFromCandidate(c)} size="sm" />
            <p className="eyebrow mt-4 mb-2">Experience</p>
            <p className="text-sm font-mono">{c.total_experience_years} yrs</p>
            <p className="eyebrow mt-4 mb-2">Matched skills</p>
            <div className="flex flex-wrap gap-1">
              {c.matched_skills.map((s) => <SkillPill key={s} label={s} variant="matched" />)}
            </div>
            <p className="eyebrow mt-4 mb-2">Missing skills</p>
            <div className="flex flex-wrap gap-1">
              {c.missing_skills.map((s) => <SkillPill key={s} label={s} variant="missing" />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
