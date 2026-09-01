import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      const data = err.response?.data;
      if (typeof data?.detail === "string") {
        setError(data.detail);
      } else if (Array.isArray(data?.detail)) {
        const msg = data.detail.map((d: any) => d.msg || `${d.loc?.join(".")}: ${d.msg}`).join(", ");
        setError(msg || "Validation error. Please check your inputs.");
      } else if (err.message) {
        setError(`Connection error: ${err.message}. Is the backend running on port 8000?`);
      } else {
        setError("Could not sign in. Check your credentials.");
      }
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
          <h1 className="text-xl font-semibold text-ink">Sign in to your workspace</h1>
        </div>
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && <p className="text-sm text-coral bg-coral-light border border-coral/30 rounded px-3 py-2">{error}</p>}
          <div>
            <label className="label-text">Email</label>
            <input className="input-field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          </div>
          <div>
            <label className="label-text">Password</label>
            <input className="input-field" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-center text-sm text-slate mt-4">
          New here? <Link to="/register" className="text-signal font-medium">Create a recruiter account</Link>
        </p>
      </div>
    </div>
  );
}
