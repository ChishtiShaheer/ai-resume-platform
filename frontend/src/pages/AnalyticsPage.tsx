import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AnalyticsOverview, api } from "../api/client";
import { Spinner } from "../components/Spinner";

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await api.get<AnalyticsOverview>("/analytics/overview");
      setData(data);
    })();
  }, []);

  if (!data) return <Spinner label="Loading analytics…" />;

  const distributionData = Object.entries(data.score_distribution).map(([bucket, count]) => ({ bucket, count }));
  const statusData = Object.entries(data.status_breakdown).map(([status, count]) => ({ status, count }));

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <p className="eyebrow mb-1">Recruitment analytics</p>
      <h1 className="text-2xl font-semibold text-ink mb-8">Pipeline overview</h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Open jobs" value={data.open_jobs} />
        <StatCard label="Total candidates" value={data.total_candidates} />
        <StatCard label="Avg. score" value={data.average_overall_score.toFixed(1)} mono />
        <StatCard label="Shortlisted" value={data.shortlisted_count} />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="card p-6">
          <p className="eyebrow mb-4">Score distribution</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={distributionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DDE1E6" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#5B6472" }} />
              <YAxis tick={{ fontSize: 11, fill: "#5B6472" }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#1D7874" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-6">
          <p className="eyebrow mb-4">Candidates by status</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DDE1E6" />
              <XAxis dataKey="status" tick={{ fontSize: 11, fill: "#5B6472" }} />
              <YAxis tick={{ fontSize: 11, fill: "#5B6472" }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#B8863C" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-6">
        <p className="eyebrow mb-4">Most common missing skills across candidates</p>
        {data.top_missing_skills.length === 0 ? (
          <p className="text-sm text-slate">No processed candidates yet.</p>
        ) : (
          <div className="space-y-2">
            {data.top_missing_skills.map(({ skill, count }) => (
              <div key={skill} className="flex items-center gap-3">
                <span className="text-sm w-32 shrink-0">{skill}</span>
                <div className="flex-1 h-2 bg-line rounded-sm overflow-hidden">
                  <div className="h-full bg-coral" style={{ width: `${(count / data.top_missing_skills[0].count) * 100}%` }} />
                </div>
                <span className="font-mono text-xs text-slate w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="card p-5">
      <p className="text-xs text-slate mb-1">{label}</p>
      <p className={`text-2xl font-semibold text-ink ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
