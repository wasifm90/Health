import { NextResponse } from "next/server";
import { InBodySchema } from "@/lib/claude";
import { bad } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";
import { isIsoDate, localDate } from "@/lib/time";

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth) return bad("Not signed in", 401);
  const body = await req.json().catch(() => null);
  const parsed = InBodySchema.safeParse(body?.data);
  if (!parsed.success) return bad("Please check the values.");
  const scanDate = isIsoDate(body?.scan_date) ? body.scan_date : isIsoDate(parsed.data.scan_date) ? parsed.data.scan_date : localDate();
  const photoPath = typeof body?.photo_path === "string" && body.photo_path.startsWith(`${auth.user.id}/`) ? body.photo_path : null;

  const res = await auth.supabase
    .from("inbody_scans")
    .insert({ user_id: auth.user.id, scan_date: scanDate, photo_path: photoPath, data: { ...parsed.data, scan_date: scanDate } })
    .select("id")
    .single();
  if (res.error) return bad(res.error.message, 500);

  if (parsed.data.weight_kg) {
    await auth.supabase.from("profiles").update({ weight_kg: parsed.data.weight_kg, updated_at: new Date().toISOString() }).eq("user_id", auth.user.id);
  }
  return NextResponse.json({ id: res.data.id });
}

export async function DELETE(req: Request) {
  const auth = await requireUser();
  if (!auth) return bad("Not signed in", 401);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("Missing id");
  const res = await auth.supabase.from("inbody_scans").delete().eq("id", id);
  if (res.error) return bad(res.error.message, 500);
  return NextResponse.json({ ok: true });
}
