"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { postJson } from "@/lib/image";

type Profile = {
  display_name: string | null;
  sex: "male" | "female" | null;
  birth_year: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: string;
  goal: string;
  sync_token: string;
} | null;

const numOrNull = (v: string) => (v === "" ? null : Number(v));

export function SettingsForm({ profile, email, syncUrl }: { profile: Profile; email: string; syncUrl: string }) {
  const router = useRouter();
  const [p, setP] = useState({
    display_name: profile?.display_name ?? "",
    sex: profile?.sex ?? "",
    birth_year: profile?.birth_year?.toString() ?? "",
    height_cm: profile?.height_cm?.toString() ?? "",
    weight_kg: profile?.weight_kg?.toString() ?? "",
    activity_level: profile?.activity_level ?? "light",
    goal: profile?.goal ?? "maintain",
  });
  const [token, setToken] = useState(profile?.sync_token ?? "");
  const [showToken, setShowToken] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(extra: Record<string, unknown> = {}) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await postJson<{ sync_token: string }>("/api/profile", {
        display_name: p.display_name || null,
        sex: p.sex || null,
        birth_year: numOrNull(p.birth_year),
        height_cm: numOrNull(p.height_cm),
        weight_kg: numOrNull(p.weight_kg),
        activity_level: p.activity_level,
        goal: p.goal,
        ...extra,
      });
      setToken(res.sync_token);
      setMsg(extra.rotate_token ? "New sync token created. Update it in Health Auto Export." : "Saved.");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Saving failed.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const field = (key: keyof typeof p, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label">{label}</label>
      <input className="input" value={p[key]} onChange={(e) => setP({ ...p, [key]: e.target.value })} {...props} />
    </div>
  );

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h2 className="font-semibold">About you</h2>
        <p className="text-sm text-neutral-500">Used to set your calorie, protein and vitamin targets. InBody weight and BMR are used when available.</p>
        {field("display_name", "Name")}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Sex</label>
            <select className="input" value={p.sex} onChange={(e) => setP({ ...p, sex: e.target.value })}>
              <option value="">—</option><option value="male">Male</option><option value="female">Female</option>
            </select>
          </div>
          {field("birth_year", "Birth year", { type: "number", inputMode: "numeric" })}
          {field("height_cm", "Height (cm)", { type: "number", inputMode: "decimal" })}
          {field("weight_kg", "Weight (kg)", { type: "number", inputMode: "decimal" })}
        </div>
        <div>
          <label className="label">Activity level</label>
          <select className="input" value={p.activity_level} onChange={(e) => setP({ ...p, activity_level: e.target.value })}>
            <option value="sedentary">Sedentary (desk job, little exercise)</option>
            <option value="light">Light (exercise 1–3 days/week)</option>
            <option value="moderate">Moderate (3–5 days/week)</option>
            <option value="active">Active (6–7 days/week)</option>
            <option value="very_active">Very active (physical job + training)</option>
          </select>
        </div>
        <div>
          <label className="label">Goal</label>
          <select className="input" value={p.goal} onChange={(e) => setP({ ...p, goal: e.target.value })}>
            <option value="lose">Lose fat</option><option value="maintain">Maintain</option><option value="gain">Build muscle / gain</option>
          </select>
        </div>
        <button className="btn-primary w-full" onClick={() => save()} disabled={busy}>Save</button>
        {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      </section>

      <section className="card space-y-2 text-sm">
        <h2 className="font-semibold">iPhone Apple Health sync</h2>
        <ol className="list-decimal space-y-1 pl-5 text-neutral-700">
          <li>Install <b>Health Auto Export – JSON+CSV</b> from the App Store and allow it to read Health data.</li>
          <li>Go to <b>Automations → New → REST API</b>.</li>
          <li>URL: paste the address below.</li>
          <li>Headers: add <code>x-sync-token</code> with your token below.</li>
          <li>Data type: <b>Health Metrics</b>. Choose steps, active energy, exercise time, sleep analysis, resting heart rate, weight.</li>
          <li>Format <b>JSON</b>, <b>Aggregate data</b> on, interval <b>Days</b>, energy unit <b>kcal</b>. Sync every hour or so.</li>
        </ol>
        <label className="label mt-2">Sync URL</label>
        <CopyField value={syncUrl} />
        <label className="label">Sync token (keep private)</label>
        <CopyField value={token} hidden={!showToken} />
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={() => setShowToken(!showToken)}>{showToken ? "Hide" : "Show"} token</button>
          <button className="btn-secondary flex-1" onClick={() => confirm("Create a new token? The old one stops working.") && save({ rotate_token: true })}>New token</button>
        </div>
      </section>

      <section className="card flex items-center justify-between text-sm">
        <span className="text-neutral-600">Signed in as {email}</span>
        <button className="btn-secondary" onClick={signOut}>Sign out</button>
      </section>
    </div>
  );
}

function CopyField({ value, hidden }: { value: string; hidden?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input readOnly className="input font-mono text-xs" value={hidden ? "•".repeat(24) : value} />
      <button className="btn-secondary shrink-0" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
