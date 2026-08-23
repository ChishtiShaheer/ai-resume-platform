export function SkillPill({ label, variant = "neutral" }: { label: string; variant?: "matched" | "missing" | "neutral" }) {
  const styles = {
    matched: "bg-signal-light text-signal border-signal/30",
    missing: "bg-coral-light text-coral border-coral/30",
    neutral: "bg-paper text-slate border-line",
  }[variant];
  return (
    <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium ${styles}`}>
      {label}
    </span>
  );
}
