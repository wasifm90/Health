import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { addNutrients, type Nutrients } from "@/lib/nutrients";
import { computeTargets, type Profile } from "@/lib/targets";
import { localDate } from "@/lib/time";
import { Progress } from "@/components/Progress";
import { MealList } from "@/components/MealList";

export const dynamic = "force-dynamic";

export default async function Home() {
  const auth = await requireUser();
  if (!auth) redirect("/login");
  const { supabase, user } = auth;
  const today = localDate();

  const [profileRes, mealsRes, metricsRes, scanRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("meals").select("id, eaten_at, meal_type, meal_items(id, name, quantity, unit, grams, nutrients)").eq("local_date", today).order("eaten_at"),
    supabase.from("health_metrics").select("metric, value").eq("metric_date", today),
    supabase.from("inbody_scans").select("data").order("scan_date", { ascending: false }).limit(1),
  ]);

  const profile = (profileRes.data ?? { activity_level: "light", goal: "maintain" }) as Profile & { display_name?: string };
  const scan = scanRes.data?.[0]?.data as { weight_kg?: number; bmr_kcal?: number } | undefined;
  const t = computeTargets(profile, { weightKg: scan?.weight_kg ?? null, bmrKcal: scan?.bmr_kcal ?? null });

  const meals = mealsRes.data ?? [];
  let totals: Nutrients = {};
  meals.forEach((m) => m.meal_items.forEach((i) => (totals = addNutrients(totals, i.nutrients as Nutrients))));
  const metrics = Object.fromEntries((metricsRes.data ?? []).map((m) => [m.metric, Number(m.value)]));
  const needsProfile = !profile.sex || !profile.height_cm || !profile.birth_year;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: process.env.REPORT_TIMEZONE || "Asia/Riyadh" })}</p>
          <h1 className="text-2xl font-bold">Hi{profile.display_name ? `, ${profile.display_name}` : ""} 👋</h1>
        </div>
        <Link href="/log" className="btn-primary">📷 Log food</Link>
      </header>

      {needsProfile && (
        <Link href="/settings" className="card block bg-amber-50 text-sm text-amber-900">
          Add your sex, height and birth year in <b>Settings</b> so your targets are accurate →
        </Link>
      )}

      <section className="card space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Today so far</h2>
          <span className="text-sm text-neutral-500">{Math.round(totals.kcal ?? 0)} / {t.kcal} kcal</span>
        </div>
        <Progress label="Protein" value={totals.protein_g ?? 0} target={t.protein_g} unit="g" />
        <Progress label="Carbs" value={totals.carbs_g ?? 0} target={t.carbs_g} unit="g" />
        <Progress label="Fat" value={totals.fat_g ?? 0} target={t.fat_g_max} unit="g" max />
        <Progress label="Fiber" value={totals.fiber_g ?? 0} target={t.fiber_g} unit="g" />
        <Progress label="Sodium" value={totals.sodium_mg ?? 0} target={t.sodium_mg_max} unit="mg" max />
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">Apple Health today</h2>
        {Object.keys(metrics).length ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {metrics.step_count !== undefined && <Stat label="Steps" value={Math.round(metrics.step_count).toLocaleString()} />}
            {metrics.active_energy !== undefined && <Stat label="Active energy" value={`${Math.round(metrics.active_energy)}`} />}
            {metrics.apple_exercise_time !== undefined && <Stat label="Exercise" value={`${Math.round(metrics.apple_exercise_time)} min`} />}
            {metrics.sleep_hours !== undefined && <Stat label="Sleep" value={`${metrics.sleep_hours.toFixed(1)} h`} />}
            {metrics.resting_heart_rate !== undefined && <Stat label="Resting HR" value={`${Math.round(metrics.resting_heart_rate)} bpm`} />}
            {metrics.weight_body_mass !== undefined && <Stat label="Weight" value={`${metrics.weight_body_mass} kg`} />}
          </dl>
        ) : (
          <p className="text-sm text-neutral-500">No data yet. Set up iPhone sync in <Link className="text-emerald-700 underline" href="/settings">Settings</Link>.</p>
        )}
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">Meals today</h2>
        <MealList meals={meals} />
      </section>

      <Link href="/report" className="card block text-center font-semibold text-emerald-700">📋 See today&apos;s flags &amp; suggestions →</Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 px-3 py-2">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
