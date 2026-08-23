import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(fullName, email, password, company || undefined);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Could not create your account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="h-2.5 w-2.5 rounded-full bg-signal inline-block" />
            <span className="font-semibold tracking-tight">Resume Screening</span>
          </div>
          <h1 className="text-xl font-semibold text-ink">Create your recruiter account</h1>
        </div>
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && <p className="text-sm text-coral bg-coral-light border border-coral/30 rounded px-3 py-2">{error}</p>}
          <div>
            <label className="label-text">Full name</label>
            <input className="input-field" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Recruiter" />
          </div>
          <div>
            <label className="label-text">Company (optional)</label>
            <input className="input-field" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Inc." />
          </div>
          <div>
            <label className="label-text">Email</label>
            <input className="input-field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          </div>
          <div>
            <label className="label-text">Password</label>
            <input className="input-field" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="text-center text-sm text-slate mt-4">
          Already have an account? <Link to="/login" className="text-signal font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
