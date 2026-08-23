/**
 * The platform's signature visual element: a segmented "readout" bar
 * that always shows the FOUR inputs behind a score (semantic, skills,
 * experience, education) rather than just the final number. This is
 * the running visual answer to "why did this candidate get this score" —
 * it appears in the candidate table, the detail view, and the scoring-
 * weights editor so the same shape always means the same thing.
 */
interface Segment {
  label: string;
  value: number; // 0-100
}

function colorFor(value: number): string {
  if (value >= 75) return "bg-signal";
  if (value >= 45) return "bg-amber";
  return "bg-coral";
}

export function ScoreReadout({
  overall,
  segments,
  size = "md",
}: {
  overall: number;
  segments: Segment[];
  size?: "sm" | "md";
}) {
  const barHeight = size === "sm" ? "h-1.5" : "h-2";
  return (
    <div className="flex items-center gap-3">
      <span
        className={`font-mono font-semibold tabular-nums ${
          size === "sm" ? "text-sm" : "text-lg"
        } ${overall >= 75 ? "text-signal" : overall >= 45 ? "text-amber" : "text-coral"}`}
      >
        {overall.toFixed(1)}
      </span>
      <div className="flex-1 min-w-[100px]">
        <div className={`flex gap-[2px] ${barHeight} rounded-sm overflow-hidden bg-line`}>
          {segments.map((seg) => (
            <div
              key={seg.label}
              className="relative group flex-1"
              title={`${seg.label}: ${seg.value.toFixed(0)}`}
            >
              <div
                className={`h-full ${colorFor(seg.value)} opacity-90`}
                style={{ width: `${Math.max(4, seg.value)}%`, minWidth: "100%" }}
              />
            </div>
          ))}
        </div>
        {size === "md" && (
          <div className="flex gap-[2px] mt-1">
            {segments.map((seg) => (
              <span key={seg.label} className="flex-1 text-center text-[9px] font-mono text-slate uppercase tracking-wide">
                {seg.label[0]}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function segmentsFromCandidate(c: {
  semantic_score: number;
  skill_score: number;
  experience_score: number;
  education_score: number;
}): Segment[] {
  return [
    { label: "Semantic", value: c.semantic_score },
    { label: "Skills", value: c.skill_score },
    { label: "Experience", value: c.experience_score },
    { label: "Education", value: c.education_score },
  ];
}
