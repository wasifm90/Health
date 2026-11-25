// Parse the JSON that the "Health Auto Export" iPhone app sends (REST API automation).
// Format: { data: { metrics: [ { name, units, data: [ { date, qty | Avg | totalSleep | asleep ... } ] } ] } }

export type DailyMetric = { metric: string; date: string; value: number; unit: string };

// Metrics where a day's samples should be added together; everything else is averaged.
const SUM = new Set([
  "step_count", "active_energy", "basal_energy_burned", "apple_exercise_time", "flights_climbed",
  "walking_running_distance", "apple_stand_hour", "dietary_water", "mindful_minutes",
]);
const LAST = new Set(["weight_body_mass", "body_fat_percentage", "lean_body_mass", "body_mass_index"]);

type Sample = Record<string, unknown> & { date?: string; qty?: number };
type MetricIn = { name?: string; units?: string; data?: Sample[] };

function sampleValue(metric: string, s: Sample): number | null {
  if (metric === "sleep_analysis") {
    const v = s.totalSleep ?? s.asleep ?? s.qty;
    return typeof v === "number" ? v : null;
  }
  for (const k of ["qty", "Avg", "avg"]) {
    const v = s[k];
    if (typeof v === "number") return v;
  }
  return null;
}

export function parseHealthExport(body: unknown): DailyMetric[] {
  const metrics = ((body as { data?: { metrics?: MetricIn[] } })?.data?.metrics ?? []) as MetricIn[];
  const acc = new Map<string, { metric: string; date: string; unit: string; values: number[] }>();

  for (const m of metrics) {
    if (!m?.name || !Array.isArray(m.data)) continue;
    const metric = m.name === "sleep_analysis" ? "sleep_hours" : m.name;
    for (const s of m.data) {
      const date = typeof s.date === "string" ? s.date.slice(0, 10) : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const value = sampleValue(m.name, s);
      if (value === null || !Number.isFinite(value)) continue;
      const key = `${metric}|${date}`;
      const entry = acc.get(key) ?? { metric, date, unit: m.name === "sleep_analysis" ? "hr" : (m.units ?? ""), values: [] };
      entry.values.push(value);
      acc.set(key, entry);
    }
  }

  return [...acc.values()].map((e) => {
    let value: number;
    if (SUM.has(e.metric) || e.metric === "sleep_hours") value = e.values.reduce((a, b) => a + b, 0);
    else if (LAST.has(e.metric)) value = e.values[e.values.length - 1];
    else value = e.values.reduce((a, b) => a + b, 0) / e.values.length;
    return { metric: e.metric, date: e.date, unit: e.unit, value: Math.round(value * 100) / 100 };
  });
}
