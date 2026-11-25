import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addNutrients, roundNutrients, type Nutrients } from "@/lib/nutrients";
import { computeTargets, type Profile, type Targets } from "@/lib/targets";
import { evaluateDay, FALLBACK_TIPS, type Flag } from "@/lib/evaluate";
import { writeSuggestions } from "@/lib/claude";
import { hasClaude } from "@/lib/env";

export type DailyReport = {
  date: string;
  generated_at: string;
  totals: Nutrients;
  meal_count: number;
  foods: string[];
  metrics: Record<string, number>;
  targets: Targets;
  flags: Flag[];
  headline: string;
  suggestions: { title: string; detail: string }[];
  ai: boolean;
};

const DEFAULT_PROFILE: Profile = { sex: null, birth_year: null, height_cm: null, weight_kg: null, activity_level: "light", goal: "maintain" };

/** Build (and save) the report for one user and one local date. Works with a user-scoped or admin client. */
export async function generateReport(db: SupabaseClient, userId: string, date: string): Promise<DailyReport> {
  const [profileRes, itemsRes, mealsRes, metricsRes, inbodyRes] = await Promise.all([
    db.from("profiles").select("sex, birth_year, height_cm, weight_kg, activity_level, goal").eq("user_id", userId).maybeSingle(),
    db.from("meal_items").select("name, quantity, unit, nutrients, meals!inner(local_date)").eq("user_id", userId).eq("meals.local_date", date),
    db.from("meals").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("local_date", date),
    db.from("health_metrics").select("metric, value").eq("user_id", userId).eq("metric_date", date),
    db.from("inbody_scans").select("scan_date, data").eq("user_id", userId).lte("scan_date", date).order("scan_date", { ascending: false }).limit(1),
  ]);

  const profile = { ...DEFAULT_PROFILE, ...(profileRes.data ?? {}) } as Profile;
  const items = itemsRes.data ?? [];
  let totals: Nutrients = {};
  for (const it of items) totals = addNutrients(totals, (it.nutrients ?? {}) as Nutrients);
  totals = roundNutrients(totals);

  const metrics: Record<string, number> = {};
  for (const m of metricsRes.data ?? []) metrics[m.metric] = Number(m.value);

  const scan = inbodyRes.data?.[0];
  const scanData = (scan?.data ?? {}) as { weight_kg?: number | null; bmr_kcal?: number | null; percent_body_fat?: number | null; visceral_fat_level?: number | null };
  const inbody = scan ? { ...scanData, scan_date: String(scan.scan_date) } : null;

  const targets = computeTargets(profile, {
    weightKg: inbody?.weight_kg ?? metrics.weight_body_mass ?? null,
    bmrKcal: inbody?.bmr_kcal ?? null,
    year: Number(date.slice(0, 4)),
  });

  const flags = evaluateDay({ totals, mealCount: mealsRes.count ?? 0, metrics, inbody, sex: profile.sex }, targets);
  const foods = items.map((i) => `${i.quantity} ${i.unit} ${i.name}`);

  let headline = "";
  let suggestions: DailyReport["suggestions"] = [];
  let ai = false;
  const problems = flags.filter((f) => f.status !== "green");

  if (hasClaude() && problems.length) {
    try {
      const summary = [
        `Date: ${date}. Goal: ${profile.goal}. Sex: ${profile.sex ?? "unknown"}.`,
        `Foods eaten: ${foods.join("; ") || "nothing logged"}.`,
        "Flags:",
        ...flags.map((f) => `- [${f.status.toUpperCase()}] ${f.label}: ${f.value ?? "?"} ${f.unit} (target ${f.target}). ${f.message}`),
      ].join("\n");
      const out = await writeSuggestions(summary);
      headline = out.headline;
      suggestions = out.suggestions;
      ai = true;
    } catch (e) {
      console.error("Suggestion generation failed", e);
    }
  }

  if (!ai) {
    const reds = flags.filter((f) => f.status === "red").length;
    const greens = flags.filter((f) => f.status === "green").length;
    headline = problems.length ? `${greens} green, ${reds} red flags today. Focus on the red ones first.` : "Everything on target — great day!";
    const order = [...problems].sort((a, b) => (a.status === b.status ? 0 : a.status === "red" ? -1 : 1));
    suggestions = order
      .filter((f) => FALLBACK_TIPS[f.key])
      .slice(0, 6)
      .map((f) => ({ title: f.label, detail: FALLBACK_TIPS[f.key] }));
  }

  const report: DailyReport = {
    date,
    generated_at: new Date().toISOString(),
    totals,
    meal_count: mealsRes.count ?? 0,
    foods,
    metrics,
    targets,
    flags,
    headline,
    suggestions,
    ai,
  };

  const saved = await db.from("daily_reports").upsert({ user_id: userId, report_date: date, report });
  if (saved.error) console.error("Saving report failed", saved.error);
  return report;
}
