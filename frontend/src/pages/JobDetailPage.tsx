import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, CandidateListItem, Job } from "../api/client";
import { FileDropzone } from "../components/FileDropzone";
import { ScoreReadout, segmentsFromCandidate } from "../components/ScoreReadout";
import { Spinner } from "../components/Spinner";

type SortKey = "rank" | "score" | "experience" | "name";
type StatusTab = "all" | "shortlisted" | "processed" | "rejected";

const STATUS_STYLE: Record<string, string> = {
  shortlisted: "text-signal bg-signal-light border-signal/40",
  rejected:    "text-coral bg-coral-light border-coral/40",
  processed:   "text-slate bg-white border-line",
  pending:     "text-slate bg-white border-line",
};

const TABS: { key: StatusTab; label: string; activeColor: string }[] = [
  { key: "all",         label: "All",         activeColor: "border-ink text-ink" },
  { key: "shortlisted", label: "Shortlisted", activeColor: "border-signal text-signal" },
  { key: "processed",   label: "Processed",   activeColor: "border-slate text-ink" },
  { key: "rejected",    label: "Rejected",    activeColor: "border-coral text-coral" },
];

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);

  const [allCandidates, setAllCandidates] = useState<CandidateListItem[]>([]);
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<StatusTab>("all");

  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("rank");

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedSkill, setDebouncedSkill]   = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selected, setSelected]      = useState<string[]>([]);
  const [showWeights, setShowWeights] = useState(false);
  const [weights, setWeights]         = useState({ semantic: 35, skills: 35, experience: 20, education: 10 });
  const [toast, setToast]             = useState<string | null>(null);

  function debounce(fn: () => void) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fn, 400);
  }

  const loadJob = useCallback(async () => {
    if (!jobId) return;
    const { data } = await api.get<Job>(`/jobs/${jobId}`);
    setJob(data);
  }, [jobId]);

  const loadAllCandidates = useCallback(async () => {
    if (!jobId) return;
    const { data } = await api.get<CandidateListItem[]>(`/jobs/${jobId}/candidates`, {
      params: { sort_by: "rank" },
    });
    setAllCandidates(data);
  }, [jobId]);

  const loadCandidates = useCallback(async () => {
    if (!jobId) return;
    const { data } = await api.get<CandidateListItem[]>(`/jobs/${jobId}/candidates`, {
      params: {
        search: debouncedSearch || undefined,
        min_score: minScore || undefined,
        skill: debouncedSkill || undefined,
        sort_by: sortBy,
        status_filter: activeTab === "all" ? undefined : activeTab,
      },
    });
    setCandidates(data);
  }, [jobId, debouncedSearch, minScore, debouncedSkill, sortBy, activeTab]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadJob(), loadAllCandidates(), loadCandidates()]);
      setLoading(false);
    })();
  }, [loadJob]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading) loadCandidates();
  }, [loadCandidates]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const hasPending = allCandidates.some((c) => c.status === "pending");
    if (!hasPending) return;
    const t = setInterval(async () => {
      await Promise.all([loadAllCandidates(), loadCandidates()]);
    }, 3000);
    return () => clearInterval(t);
  }, [allCandidates, loadAllCandidates, loadCandidates]);

  const counts: Record<StatusTab, number> = {
    all:         allCandidates.length,
    shortlisted: allCandidates.filter((c) => c.status === "shortlisted").length,
    processed:   allCandidates.filter((c) => c.status === "processed").length,
    rejected:    allCandidates.filter((c) => c.status === "rejected").length,
  };

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
      await Promise.all([loadAllCandidates(), loadCandidates()]);
    } catch (err: any) {
      setUploadMsg(err.response?.data?.detail || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleExport(format: "csv" | "xlsx") {
    try {
      const response = await api.post(
        `/jobs/${jobId}/candidates/export?format=${format}`,
        null,
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `shortlist.${format}`;
      a.click();
    } catch (err: any) {
      alert("Export failed: " + (err.response?.data?.detail || err.message));
    }
  }

  async function updateWeights() {
    await api.patch(`/jobs/${jobId}/scoring-weights`, weights);
    setShowWeights(false);
    showToast("Scoring weights updated and candidates re-scored.");
    await Promise.all([loadAllCandidates(), loadCandidates()]);
  }

  async function setStatus(candidateId: string, status: string) {
    try {
      await api.patch(`/candidates/${candidateId}/status`, null, { params: { new_status: status } });
      const update = (list: CandidateListItem[]) =>
        list.map((c) => (c.id === candidateId ? { ...c, status } : c));
      setAllCandidates(update);
      setCandidates(update);
      const labels: Record<string, string> = {
        shortlisted: "Shortlisted ✓", rejected: "Rejected ✗", processed: "Processed",
      };
      showToast(`Candidate marked as "${labels[status] ?? status}" — saved.`);
    } catch (err: any) {
      alert("Failed to update status: " + (err.response?.data?.detail || err.message));
    }
  }

  function copyEmails(list: CandidateListItem[]) {
    const emails = list.map((c) => c.email).filter(Boolean).join(", ");
    if (!emails) { showToast("No emails available in this section."); return; }
    navigator.clipboard.writeText(emails);
    showToast(`${list.filter((c) => c.email).length} email(s) copied to clipboard!`);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
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
                <input type="number" className="input-field" value={weights[k]}
                  onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })} />
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

      {toast && (
        <div className="mb-4 text-sm text-signal bg-signal-light border border-signal/30 rounded px-4 py-2.5 w-fit">
          ✓ {toast}
        </div>
      )}

      {/* ── STATUS TABS ───────────────────────────────────────────── */}
      <div className="flex items-center border-b border-line mb-5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSelected([]); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? `${tab.activeColor} border-current`
                : "border-transparent text-slate hover:text-ink"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs font-mono bg-paper px-1.5 py-0.5 rounded-full">
              {counts[tab.key]}
            </span>
          </button>
        ))}

        {candidates.length > 0 && (
          <button
            className="ml-auto mb-1 text-xs text-slate hover:text-ink border border-line rounded px-3 py-1.5"
            onClick={() => copyEmails(candidates)}
            title="Copy all visible emails to clipboard"
          >
            📋 Copy {candidates.filter((c) => c.email).length} email(s)
          </button>
        )}
      </div>

      {/* Section banners */}
      {activeTab === "shortlisted" && (
        <div className="mb-4 text-sm text-signal bg-signal-light border border-signal/20 rounded px-4 py-3">
          <strong>Shortlisted candidates</strong> — Your top picks. Click <strong>📋 Copy emails</strong> to reach out to all of them at once, or export to CSV/XLSX.
        </div>
      )}
      {activeTab === "rejected" && (
        <div className="mb-4 text-sm text-coral bg-coral-light border border-coral/20 rounded px-4 py-3">
          <strong>Rejected candidates</strong> — Did not meet criteria. You can still view their profiles or move them back to Processed.
        </div>
      )}
      {activeTab === "processed" && (
        <div className="mb-4 text-sm text-slate bg-paper border border-line rounded px-4 py-3">
          <strong>Processed candidates</strong> — Scored and ranked, awaiting your review. Move them to Shortlisted or Rejected.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-2 items-center">
        <input className="input-field max-w-[220px]" placeholder="Search by name/email" value={search}
          onChange={(e) => { setSearch(e.target.value); debounce(() => setDebouncedSearch(e.target.value)); }} />
        <input className="input-field max-w-[140px]" placeholder="Min score" type="number" value={minScore}
          onChange={(e) => setMinScore(e.target.value)} />
        <input className="input-field max-w-[180px]" placeholder="Filter by skill" value={skillFilter}
          onChange={(e) => { setSkillFilter(e.target.value); debounce(() => setDebouncedSkill(e.target.value)); }} />
        <select className="input-field max-w-[160px]" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
          <option value="rank">Sort: Rank</option>
          <option value="score">Sort: Score</option>
          <option value="experience">Sort: Experience</option>
          <option value="name">Sort: Name</option>
        </select>
        {selected.length >= 2 && (
          <Link className="btn-secondary" to={`/jobs/${jobId}/compare?ids=${selected.join(",")}`}>
            Compare {selected.length} candidates →
          </Link>
        )}
        {selected.length === 1 && <span className="text-xs text-slate italic">Select 1 more to compare</span>}
      </div>
      {selected.length === 0 && candidates.length > 0 && (
        <p className="text-xs text-slate mb-4">☑ Tip: Check 2 or more candidates to compare them side-by-side.</p>
      )}

      {/* Candidate table */}
      {candidates.length === 0 ? (
        <div className="card p-10 text-center text-slate text-sm">
          {activeTab === "all"
            ? "No candidates yet — upload resumes above."
            : `No ${activeTab} candidates yet. Change a candidate's status from the All tab.`}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper border-b border-line text-left text-xs uppercase tracking-wide text-slate">
              <tr>
                <th className="px-4 py-3 w-8" title="Check 2+ to compare side-by-side">Compare</th>
                <th className="px-2 py-3 w-10">#</th>
                <th className="px-2 py-3">Candidate</th>
                <th className="px-2 py-3 w-64">Score readout</th>
                <th className="px-2 py-3">Skills</th>
                <th className="px-2 py-3 w-24">Exp.</th>
                <th className="px-2 py-3 w-32">Status</th>
                <th className="px-2 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr
                  key={c.id}
                  className={`border-b border-line last:border-0 hover:bg-paper/60 ${selected.includes(c.id) ? "bg-signal-light/20" : ""}`}
                >
                  <td className="px-4 py-3">
                    <input type="checkbox" title="Select to compare side-by-side" checked={selected.includes(c.id)}
                      onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id))} />
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
                      className={`text-xs border rounded-sm px-1.5 py-1 font-medium ${STATUS_STYLE[c.status] ?? "bg-white border-line text-slate"}`}
                      value={c.status}
                      onChange={(e) => setStatus(c.id, e.target.value)}
                      disabled={c.status === "pending"}
                    >
                      <option value="processed">Processed</option>
                      <option value="shortlisted">Shortlisted ✓</option>
                      <option value="rejected">Rejected ✗</option>
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
