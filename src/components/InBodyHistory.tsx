"use client";
import { useRouter } from "next/navigation";
import { INBODY_FIELDS } from "@/components/InBodyFields";

type Scan = { id: string; scan_date: string; data: Record<string, number | string | null> };

export function InBodyHistory({ scans }: { scans: Scan[] }) {
  const router = useRouter();
  if (!scans.length) return <p className="card text-sm text-neutral-500">No scans yet.</p>;
  const [latest, previous] = scans;
  const keys = ["weight_kg", "skeletal_muscle_mass_kg", "body_fat_mass_kg", "percent_body_fat", "visceral_fat_level", "bmr_kcal"];

  async function remove(id: string) {
    if (!confirm("Delete this scan?")) return;
    await fetch(`/api/inbody/save?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <section className="card">
        <h2 className="mb-2 font-semibold">Latest scan · {latest.scan_date}</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {keys.map((k) => {
            const meta = INBODY_FIELDS.find((f) => f.key === k)!;
            const v = latest.data[k];
            const p = previous?.data[k];
            const diff = typeof v === "number" && typeof p === "number" ? Math.round((v - p) * 10) / 10 : null;
            return (
              <div key={k} className="rounded-xl bg-neutral-50 px-3 py-2">
                <dt className="text-xs text-neutral-500">{meta.label}</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {v ?? "–"} <span className="text-xs font-normal text-neutral-500">{meta.unit}</span>
                  {diff !== null && diff !== 0 && <span className="ml-1 text-xs font-normal text-neutral-500">({diff > 0 ? "+" : ""}{diff})</span>}
                </dd>
              </div>
            );
          })}
        </dl>
        {previous && <p className="mt-2 text-xs text-neutral-500">Change shown vs {previous.scan_date}.</p>}
      </section>
      <section className="card">
        <h2 className="mb-2 font-semibold">History</h2>
        <ul className="divide-y divide-neutral-100 text-sm">
          {scans.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2">
              <span>{s.scan_date}</span>
              <span className="tabular-nums text-neutral-600">{s.data.weight_kg ?? "–"} kg · {s.data.percent_body_fat ?? "–"}% fat</span>
              <button className="text-xs text-rose-600" onClick={() => remove(s.id)}>Delete</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
