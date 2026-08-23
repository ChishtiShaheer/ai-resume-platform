import { FormEvent, useState } from "react";
import { api } from "../api/client";

/**
 * Floating recruiter AI assistant — free-text Q&A over indexed job +
 * candidate data (e.g. "who are my top 3 candidates for X" or
 * "which candidates know Kubernetes"). Available on every screen.
 */
export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAsk(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setAnswer(null);
    try {
      const { data } = await api.post("/assistant/query", { query });
      setAnswer(data.answer);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open ? (
        <div className="card w-80 shadow-lg p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-ink">Recruiter AI assistant</p>
            <button onClick={() => setOpen(false)} className="text-slate hover:text-ink text-sm">✕</button>
          </div>
          <form onSubmit={handleAsk} className="space-y-2">
            <input
              className="input-field text-sm"
              placeholder="Ask about your candidates or jobs…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="btn-primary w-full text-sm" disabled={loading}>
              {loading ? "Thinking…" : "Ask"}
            </button>
          </form>
          {answer && <p className="text-sm text-ink mt-3 leading-relaxed border-t border-line pt-3">{answer}</p>}
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="btn-primary shadow-lg rounded-full h-12 w-12 p-0 text-lg">
          ✦
        </button>
      )}
    </div>
  );
}
