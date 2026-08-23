import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, CandidateListItem, Job } from "../api/client";
import { FileDropzone } from "../components/FileDropzone";
import { ScoreReadout, segmentsFromCandidate } from "../components/ScoreReadout";
import { Spinner } from "../components/Spinner";

type SortKey = "rank" | "score" | "experience" | "name";

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("rank");
  const [selected, setSelected] = useState<string[]>([]);

  const [showWeights, setShowWeights] = useState(false);
  const [weights, setWeights] = useState({ semantic: 35, skills: 35, experience: 20, education: 10 });

  const loadJob = useCallback(async () => {
    if (!jobId) return;
    const { data } = await api.get<Job>(`/jobs/${jobId}`);
    setJob(data);
  }, [jobId]);

  const loadCandidates = useCallback(async () => {
    if (!jobId) return;
    const { data } = await api.get<CandidateListItem[]>(`/jobs/${jobId}/candidates`, {
      params: {
        search: search || undefined,
        min_score: minScore || undefined,
        skill: skillFilter || undefined,
        sort_by: sortBy,
      },
    });
    setCandidates(data);
  }, [jobId, search, minScore, skillFilter, sortBy]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadJob(), loadCandidates()]);
      setLoading(false);
    })();
  }, [loadJob, loadCandidates]);

  // Poll while any candidate is still pending (background processing)
  useEffect(() => {
    const hasPending = candidates.some((c) => c.status === "pending");
    if (!hasPending) return;
    const t = setInterval(loadCandidates, 3000);
    return () => clearInterval(t);
  }, [candidates, loadCandidates]);

  async function handleUpload(files: FileList) {
    if (!jobId) return;
    setUploading(true);
    setUploadMsg(null);
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("files", f));
    try {
      const { data } = await api.post(`/jobs/${jobId}/resumes`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadMsg(data.message);
      await loadCandidates();
    } catch (err: any) {
      setUploadMsg(err.response?.data?.detail || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleExport(format: "csv" | "xlsx") {
    const response = await api.post(`/jobs/${jobId}/candidates/export?format=${format}`, null, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.download = `shortlist.${format}`;
    link.click();
  }

  async function updateWeights() {
    await api.patch(`/jobs/${jobId}/scoring-weights`, weights);
    setShowWeights(false);
    await loadCandidates();
  }

  async function setStatus(candidateId: string, status: string) {
    await api.patch(`/candidates/${candidateId}/status`, null, { params: { new_status: status } });
    await loadCandidates();
  }

  if (loading) return <Spinner label="Loading job…" />;
  if (!job) return <div className="max-w-6xl mx-auto px-6 py-10">Job not found.</div>;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <Link to="/" className="text-sm text-slate hover:text-ink mb-4 inline-block">← All jobs</Link>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink mb-1">{job.title}</h1>
          <p className="text-sm text-slate max-w-2xl">{job.description}</p>
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {job.required_skills.map((s) => (
              <span key={s} className="text-xs px-2 py-0.5 rounded-sm bg-paper border border-line text-slate">{s}</span>
            ))}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button className="btn-secondary" onClick={() => setShowWeights((v) => !v)}>Scoring weights</button>
          <button className="btn-secondary" onClick={() => handleExport("csv")}>Export CSV</button>
          <button className="btn-secondary" onClick={() => handleExport("xlsx")}>Export XLSX</button>
        </div>
      </div>

      {showWeights && (
        <div className="card p-5 mb-6">
          <p className="eyebrow mb-3">Configurable scoring criteria — weights are normalized to sum to 100%</p>
          <div className="grid grid-cols-4 gap-4 mb-4">
            {(Object.keys(weights) as (keyof typeof weights)[]).map((k) => (
              <div key={k}>
                <label className="label-text capitalize">{k}</label>
                <input
                  type="number"
                  className="input-field"
                  value={weights[k]}
                  onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })}
                />
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={updateWeights}>Apply and re-score all candidates</button>
        </div>
      )}

      <div className="card p-6 mb-8">
        <FileDropzone onFiles={handleUpload} disabled={uploading} />
        {uploading && <p className="text-sm text-slate mt-3">Uploading and queuing for processing…</p>}
        {uploadMsg && <p className="text-sm text-signal mt-3">{uploadMsg}</p>}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input className="input-field max-w-[220px]" placeholder="Search by name/email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <input className="input-field max-w-[140px]" placeholder="Min score" type="number" value={minScore} onChange={(e) => setMinScore(e.target.value)} />
        <input className="input-field max-w-[180px]" placeholder="Filter by skill" value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} />
        <select className="input-field max-w-[160px]" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
          <option value="rank">Sort: Rank</option>
          <option value="score">Sort: Score</option>
          <option value="experience">Sort: Experience</option>
          <option value="name">Sort: Name</option>
        </select>
        {selected.length >= 2 && (
          <Link className="btn-secondary" to={`/jobs/${jobId}/compare?ids=${selected.join(",")}`}>
            Compare {selected.length} candidates
          </Link>
        )}
      </div>

      {candidates.length === 0 ? (
        <div className="card p-10 text-center text-slate text-sm">No candidates yet — upload resumes above.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper border-b border-line text-left text-xs uppercase tracking-wide text-slate">
              <tr>
                <th className="px-4 py-3 w-8"></th>
                <th className="px-2 py-3 w-10">#</th>
                <th className="px-2 py-3">Candidate</th>
                <th className="px-2 py-3 w-64">Score readout</th>
                <th className="px-2 py-3">Skills</th>
                <th className="px-2 py-3 w-24">Exp.</th>
                <th className="px-2 py-3 w-28">Status</th>
                <th className="px-2 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0 hover:bg-paper/60">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.includes(c.id)} onChange={(e) => {
                      setSelected((prev) => e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id));
                    }} />
                  </td>
                  <td className="px-2 py-3 font-mono text-slate">{c.rank ?? "—"}</td>
                  <td className="px-2 py-3">
                    <Link to={`/candidates/${c.id}`} className="font-medium text-ink hover:text-signal">
                      {c.full_name || "Unnamed candidate"}
                    </Link>
                    <p className="text-xs text-slate">{c.email || "—"}</p>
                  </td>
                  <td className="px-2 py-3">
                    {c.status === "processed" || c.status === "shortlisted" || c.status === "rejected" ? (
                      <ScoreReadout overall={c.overall_score} segments={segmentsFromCandidate(c)} size="sm" />
                    ) : (
                      <span className="text-xs text-slate italic">{c.status === "pending" ? "Processing…" : c.status}</span>
                    )}
                  </td>
                  <td className="px-2 py-3 max-w-[220px]">
                    <div className="flex flex-wrap gap-1">
                      {c.matched_skills.slice(0, 3).map((s) => (
                        <span key={s} className="text-[11px] px-1.5 py-0.5 rounded-sm bg-signal-light text-signal">{s}</span>
                      ))}
                      {c.missing_skills.slice(0, 2).map((s) => (
                        <span key={s} className="text-[11px] px-1.5 py-0.5 rounded-sm bg-coral-light text-coral">{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-3 font-mono">{c.total_experience_years}y</td>
                  <td className="px-2 py-3">
                    <select
                      className="text-xs border border-line rounded-sm px-1.5 py-1 bg-white"
                      value={c.status}
                      onChange={(e) => setStatus(c.id, e.target.value)}
                    >
                      <option value="processed">Processed</option>
                      <option value="shortlisted">Shortlisted</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </td>
                  <td className="px-2 py-3">
                    <Link to={`/candidates/${c.id}`} className="text-xs text-signal font-medium">View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
