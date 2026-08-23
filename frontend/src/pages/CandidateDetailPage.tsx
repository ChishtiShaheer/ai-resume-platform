import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, CandidateDetail } from "../api/client";
import { ScoreReadout, segmentsFromCandidate } from "../components/ScoreReadout";
import { SkillPill } from "../components/SkillPill";
import { Spinner } from "../components/Spinner";

export default function CandidateDetailPage() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    (async () => {
      if (!candidateId) return;
      const { data } = await api.get<CandidateDetail>(`/candidates/${candidateId}`);
      setCandidate(data);
      setQuestions(data.interview_questions || []);
      setLoading(false);
    })();
  }, [candidateId]);

  async function generateQuestions() {
    setGenerating(true);
    const { data } = await api.post(`/candidates/${candidateId}/interview-questions`, {
      candidate_id: candidateId,
      num_questions: 5,
    });
    setQuestions(data.questions);
    setGenerating(false);
  }

  if (loading) return <Spinner label="Loading candidate…" />;
  if (!candidate) return <div className="max-w-4xl mx-auto px-6 py-10">Candidate not found.</div>;

  const breakdown = candidate.score_breakdown || {};

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link to={-1 as any} className="text-sm text-slate hover:text-ink mb-4 inline-block">← Back</Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{candidate.full_name || "Unnamed candidate"}</h1>
          <p className="text-sm text-slate">{candidate.email} {candidate.phone ? `· ${candidate.phone}` : ""}</p>
          <p className="text-xs text-slate mt-1">
            Source: {candidate.original_filename} {candidate.used_ocr === "yes" && <span className="text-amber">(text extracted via OCR)</span>}
          </p>
        </div>
        <span className="text-xs px-2 py-1 rounded-sm border border-line text-slate capitalize">{candidate.status}</span>
      </div>

      <div className="card p-6 mb-6">
        <p className="eyebrow mb-3">Overall relevance score</p>
        <ScoreReadout overall={candidate.overall_score} segments={segmentsFromCandidate(candidate)} />
      </div>

      {candidate.summary && (
        <div className="card p-6 mb-6">
          <p className="eyebrow mb-2">AI candidate summary</p>
          <p className="text-sm text-ink leading-relaxed">{candidate.summary}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="card p-6">
          <p className="eyebrow mb-3">Matched skills ({candidate.matched_skills.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {candidate.matched_skills.map((s) => <SkillPill key={s} label={s} variant="matched" />)}
            {candidate.matched_skills.length === 0 && <p className="text-sm text-slate">None matched.</p>}
          </div>
        </div>
        <div className="card p-6">
          <p className="eyebrow mb-3">Missing skills ({candidate.missing_skills.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {candidate.missing_skills.map((s) => <SkillPill key={s} label={s} variant="missing" />)}
            {candidate.missing_skills.length === 0 && <p className="text-sm text-slate">No gaps detected.</p>}
          </div>
        </div>
      </div>

      <div className="card p-6 mb-6">
        <p className="eyebrow mb-3">Score breakdown — why this score</p>
        <div className="space-y-3">
          {["semantic", "skills", "experience", "education"].map((key) => {
            const b = breakdown[key];
            if (!b) return null;
            return (
              <div key={key} className="flex justify-between items-start border-b border-line last:border-0 pb-3 last:pb-0">
                <div>
                  <p className="text-sm font-medium capitalize text-ink">{key}</p>
                  <p className="text-xs text-slate mt-0.5">{b.explanation}</p>
                </div>
                <span className="font-mono text-sm font-semibold text-ink shrink-0 ml-4">{b.score?.toFixed?.(1) ?? b.score}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="card p-6">
          <p className="eyebrow mb-3">Experience ({candidate.total_experience_years} yrs total)</p>
          <ul className="space-y-2">
            {candidate.experience.map((e: any, i: number) => (
              <li key={i} className="text-sm text-ink">
                <span className="font-mono text-xs text-slate">{e.period}</span> — {e.context || "Role details not clearly parsed"}
              </li>
            ))}
            {candidate.experience.length === 0 && <p className="text-sm text-slate">No experience entries parsed.</p>}
          </ul>
        </div>
        <div className="card p-6">
          <p className="eyebrow mb-3">Education</p>
          <ul className="space-y-2">
            {candidate.education.map((e: any, i: number) => (
              <li key={i} className="text-sm text-ink">{e.degree} {e.year ? `(${e.year})` : ""}</li>
            ))}
            {candidate.education.length === 0 && <p className="text-sm text-slate">No education entries parsed.</p>}
          </ul>
          {candidate.certifications.length > 0 && (
            <>
              <p className="eyebrow mt-4 mb-2">Certifications</p>
              <ul className="space-y-1">
                {candidate.certifications.map((c, i) => <li key={i} className="text-sm text-ink">{c}</li>)}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-3">
          <p className="eyebrow">AI-generated interview questions</p>
          <button className="btn-secondary text-xs" onClick={generateQuestions} disabled={generating}>
            {generating ? "Generating…" : questions.length ? "Regenerate" : "Generate questions"}
          </button>
        </div>
        {questions.length > 0 ? (
          <ol className="list-decimal list-inside space-y-2 text-sm text-ink">
            {questions.map((q, i) => <li key={i}>{q}</li>)}
          </ol>
        ) : (
          <p className="text-sm text-slate">No questions generated yet.</p>
        )}
      </div>
    </div>
  );
}
