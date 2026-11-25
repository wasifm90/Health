import type { Flag } from "@/lib/evaluate";

export const STATUS_STYLE = {
  green: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", label: "Green" },
  amber: { dot: "bg-amber-400", text: "text-amber-700", bg: "bg-amber-50", label: "Amber" },
  red: { dot: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50", label: "Red" },
} as const;

export function FlagRow({ f }: { f: Flag }) {
  const s = STATUS_STYLE[f.status];
  return (
    <li className="flex items-start gap-3 py-2">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`} aria-label={s.label} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium">{f.label}</span>
          <span className="shrink-0 text-sm tabular-nums text-neutral-600">
            {f.value ?? "–"} {f.unit} <span className="text-neutral-400">/ {f.target}</span>
          </span>
        </div>
        <p className={`text-sm ${f.status === "green" ? "text-neutral-500" : s.text}`}>{f.message}</p>
      </div>
    </li>
  );
}

export function FlagCounts({ flags }: { flags: Flag[] }) {
  const c = { green: 0, amber: 0, red: 0 };
  flags.forEach((f) => c[f.status]++);
  return (
    <div className="grid grid-cols-3 gap-2">
      {(["green", "amber", "red"] as const).map((k) => (
        <div key={k} className={`rounded-xl px-3 py-2 text-center ${STATUS_STYLE[k].bg}`}>
          <div className={`text-2xl font-bold tabular-nums ${STATUS_STYLE[k].text}`}>{c[k]}</div>
          <div className="text-xs text-neutral-600">{STATUS_STYLE[k].label} flags</div>
        </div>
      ))}
    </div>
  );
}
