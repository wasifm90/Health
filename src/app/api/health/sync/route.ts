import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { parseHealthExport } from "@/lib/healthSync";
import { bad } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

/** Receives Apple Health data from the Health Auto Export app. Authenticated by the user's sync token. */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = req.headers.get("x-sync-token") ?? url.searchParams.get("token") ?? "";
  if (!/^[a-f0-9]{48}$/.test(token)) return bad("Missing or invalid sync token", 401);

  const admin = createAdminClient();
  const profile = await admin.from("profiles").select("user_id, sync_token").eq("sync_token", token).maybeSingle();
  if (!profile.data || !timingSafeEqual(Buffer.from(profile.data.sync_token), Buffer.from(token))) {
    return bad("Unknown sync token", 401);
  }

  const body = await req.json().catch(() => null);
  const rows = parseHealthExport(body).map((m) => ({
    user_id: profile.data!.user_id,
    metric: m.metric,
    metric_date: m.date,
    value: m.value,
    unit: m.unit,
    updated_at: new Date().toISOString(),
  }));
  if (!rows.length) return NextResponse.json({ ok: true, saved: 0, note: "No daily metrics found in the payload." });

  for (let i = 0; i < rows.length; i += 500) {
    const res = await admin.from("health_metrics").upsert(rows.slice(i, i + 500));
    if (res.error) return bad(res.error.message, 500);
  }
  return NextResponse.json({ ok: true, saved: rows.length });
}
