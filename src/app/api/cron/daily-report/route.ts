import { NextResponse } from "next/server";
import { generateReport } from "@/lib/report";
import { bad } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, localDate } from "@/lib/time";

export const maxDuration = 300;

/** Vercel Cron calls this every morning to build yesterday's report for every user. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return bad("Unauthorized", 401);

  const date = addDays(localDate(), -1);
  const admin = createAdminClient();
  const { data: users, error } = await admin.from("profiles").select("user_id");
  if (error) return bad(error.message, 500);

  const results: { user: string; ok: boolean }[] = [];
  for (const u of users ?? []) {
    try {
      await generateReport(admin, u.user_id, date);
      results.push({ user: u.user_id, ok: true });
    } catch (e) {
      console.error("Report failed", u.user_id, e);
      results.push({ user: u.user_id, ok: false });
    }
  }
  return NextResponse.json({ date, results });
}
