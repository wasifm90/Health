import { NextResponse } from "next/server";
import { generateReport } from "@/lib/report";
import { bad, errorMessage } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";
import { isIsoDate, localDate } from "@/lib/time";

export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth) return bad("Not signed in", 401);
  const body = await req.json().catch(() => ({}));
  const date = isIsoDate(body?.date) ? body.date : localDate();
  try {
    return NextResponse.json(await generateReport(auth.supabase, auth.user.id, date));
  } catch (e) {
    console.error(e);
    return bad(errorMessage(e), 500);
  }
}
