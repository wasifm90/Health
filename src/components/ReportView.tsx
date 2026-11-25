"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DailyReport } from "@/lib/report";
import { FlagCounts, FlagRow } from "@/components/Flags";
import { postJson } from "@/lib/image";

const SECTIONS: { area: string[]; title: string }[] = [
  { area: ["nutrition"], title: "Macros & limits" },
  { area: ["micronutrient"], title: "Vitamins & minerals" },
  { area: ["activity", "sleep"], title: "Activity & sleep (Apple Health)" },
  { area: ["body"], title: "Body composition (InBody)" },
];

export function ReportView({ date, initial }: { date: string; initial: DailyReport | null }) {
  const router = useRouter();
  const [report, setReport] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGreen, setShowGreen] = useState(false);

  useEffect(() => setReport(initial), [initial]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      setReport(await postJson<DailyReport>("/api/report", { date }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build the report.");
    } finally {
      setBusy(false);
    }
  }

  // Build today's report automatically the first time it's opened.
  useEffect(() => {
    if (!initial) void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Daily report</h1>
        <input type="date" className="input w-auto" value={date} onChange={(e) => e.target.value && router.push(`/report?date=${e.target.value}`)} />
      </header>

      {error && <p className="card bg-rose-50 text-sm text-rose-800">{error}</p>}
      {busy && !report && <p className="card animate-pulse text-center text-sm text-neutral-600">Building your report…</p>}

      {report && (
        <>
          <section className="card space-y-3">
            <p className="font-medium">{report.headline}</p>
            <FlagCounts flags={report.flags} />
            <p className="text-xs text-neutral-500">
              {report.meal_count} meal{report.meal_count === 1 ? "" : "s"} logged · target {report.targets.kcal} kcal, {report.targets.protein_g} g protein, {report.targets.fiber_g} g fiber
            </p>
          </section>

          {report.suggestions.length > 0 && (
            <section className="card">
              <h2 className="mb-2 font-semibold">💡 How to fix the red flags</h2>
              <ol className="list-decimal space-y-2 pl-5 text-sm">
                {report.suggestions.map((s, i) => (
                  <li key={i}><b>{s.title}.</b> {s.detail}</li>
                ))}
              </ol>
            </section>
          )}

          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input type="checkbox" checked={showGreen} onChange={(e) => setShowGreen(e.target.checked)} /> Show green flags too
          </label>

          {SECTIONS.map((sec) => {
            const all = report.flags.filter((f) => sec.area.includes(f.area));
            const order = { red: 0, amber: 1, green: 2 };
            const flags = all.filter((f) => showGreen || f.status !== "green").sort((a, b) => order[a.status] - order[b.status]);
            if (!all.length) return null;
            return (
              <section key={sec.title} className="card">
                <h2 className="font-semibold">{sec.title}</h2>
                {flags.length ? (
                  <ul className="divide-y divide-neutral-100">{flags.map((f) => <FlagRow key={f.key} f={f} />)}</ul>
                ) : (
                  <p className="py-2 text-sm text-emerald-700">✅ All {all.length} on target.</p>
                )}
              </section>
            );
          })}

          {report.targets.assumptions.length > 0 && (
            <p className="text-xs text-amber-700">Note: {report.targets.assumptions.join(" ")}</p>
          )}
          <p className="text-xs text-neutral-500">
            Nutrient values come from USDA FoodData Central and are estimates; some foods have incomplete vitamin and mineral data.
            This is general guidance, not medical advice.
          </p>
          <button className="btn-secondary w-full" onClick={generate} disabled={busy}>{busy ? "Updating…" : "↻ Update report"}</button>
          <p className="text-center text-xs text-neutral-400">Generated {new Date(report.generated_at).toLocaleString("en-GB")}</p>
        </>
      )}
    </div>
  );
}
