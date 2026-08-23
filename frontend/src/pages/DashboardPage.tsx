import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Job } from "../api/client";
import { Spinner } from "../components/Spinner";

const emptyForm = {
  title: "",
  description: "",
  department: "",
  location: "",
  seniority: "",
  required_skills: "",
  preferred_skills: "",
  min_experience_years: 0,
  required_education: "",
};

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  async function loadJobs() {
    setLoading(true);
    const { data } = await api.get<Job[]>("/jobs", { params: search ? { search } : {} });
    setJobs(data);
    setLoading(false);
  }

  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/jobs", {
        ...form,
        required_skills: form.required_skills.split(",").map((s) => s.trim()).filter(Boolean),
        preferred_skills: form.preferred_skills.split(",").map((s) => s.trim()).filter(Boolean),
        min_experience_years: Number(form.min_experience_years) || 0,
      });
      setForm(emptyForm);
      setShowForm(false);
      await loadJobs();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="eyebrow mb-1">Recruiter workspace</p>
          <h1 className="text-2xl font-semibold text-ink">Open positions</h1>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ New job"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card p-6 mb-8 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label-text">Job title</label>
              <input className="input-field" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Senior Backend Engineer" />
            </div>
            <div className="col-span-2">
              <label className="label-text">Job description</label>
              <textarea className="input-field min-h-[100px]" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Paste or write the full job description — this is compared semantically against each resume." />
            </div>
            <div>
              <label className="label-text">Department</label>
              <input className="input-field" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Location</label>
              <input className="input-field" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <label className="label-text">Seniority</label>
              <select className="input-field" value={form.seniority} onChange={(e) => setForm({ ...form, seniority: e.target.value })}>
                <option value="">—</option>
                <option value="junior">Junior</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead</option>
              </select>
            </div>
            <div>
              <label className="label-text">Min. years experience</label>
              <input className="input-field" type="number" min={0} step={0.5} value={form.min_experience_years} onChange={(e) => setForm({ ...form, min_experience_years: Number(e.target.value) })} />
            </div>
            <div className="col-span-2">
              <label className="label-text">Required skills (comma-separated)</label>
              <input className="input-field" required value={form.required_skills} onChange={(e) => setForm({ ...form, required_skills: e.target.value })} placeholder="python, fastapi, postgresql, docker" />
            </div>
            <div className="col-span-2">
              <label className="label-text">Preferred skills (comma-separated, optional)</label>
              <input className="input-field" value={form.preferred_skills} onChange={(e) => setForm({ ...form, preferred_skills: e.target.value })} placeholder="kubernetes, aws" />
            </div>
            <div className="col-span-2">
              <label className="label-text">Required education (optional)</label>
              <input className="input-field" value={form.required_education} onChange={(e) => setForm({ ...form, required_education: e.target.value })} placeholder="Bachelor's in Computer Science" />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? "Creating…" : "Create job"}
          </button>
        </form>
      )}

      <input
        className="input-field max-w-xs mb-4"
        placeholder="Search jobs…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <Spinner label="Loading jobs…" />
      ) : jobs.length === 0 ? (
        <div className="card p-10 text-center text-slate text-sm">
          No jobs yet. Create your first job posting to start screening candidates.
        </div>
      ) : (
        <div className="grid gap-3">
          {jobs.map((job) => (
            <Link key={job.id} to={`/jobs/${job.id}`} className="card p-5 flex items-center justify-between hover:border-signal/50 transition">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-ink">{job.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-sm border ${job.status === "open" ? "border-signal/30 text-signal bg-signal-light" : "border-line text-slate"}`}>
                    {job.status}
                  </span>
                </div>
                <p className="text-sm text-slate">
                  {job.department || "—"} {job.location ? `· ${job.location}` : ""} · {job.required_skills.slice(0, 4).join(", ")}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-lg font-semibold text-ink">{job.candidate_count}</p>
                <p className="text-xs text-slate">candidates</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
