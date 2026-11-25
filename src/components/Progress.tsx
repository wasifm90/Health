export function Progress({ label, value, target, unit, max }: { label: string; value: number; target: number; unit: string; max?: boolean }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const ratio = target > 0 ? value / target : 0;
  const color = max
    ? ratio <= 1 ? "bg-emerald-500" : ratio <= 1.3 ? "bg-amber-400" : "bg-rose-500"
    : ratio >= 0.9 ? "bg-emerald-500" : ratio >= 0.7 ? "bg-amber-400" : "bg-rose-400";
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-neutral-600">
          {Math.round(value)} / {Math.round(target)} {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
