export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-slate text-sm py-8 justify-center">
      <span className="h-3 w-3 rounded-full border-2 border-slate/30 border-t-signal animate-spin" />
      {label && <span>{label}</span>}
    </div>
  );
}
