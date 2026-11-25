import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { bad } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";

const Body = z.object({
  display_name: z.string().max(80).nullable().optional(),
  sex: z.enum(["male", "female"]).nullable().optional(),
  birth_year: z.number().int().min(1900).max(2025).nullable().optional(),
  height_cm: z.number().min(80).max(250).nullable().optional(),
  weight_kg: z.number().min(20).max(400).nullable().optional(),
  activity_level: z.enum(["sedentary", "light", "moderate", "active", "very_active"]).optional(),
  goal: z.enum(["lose", "maintain", "gain"]).optional(),
  rotate_token: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth) return bad("Not signed in", 401);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Please check the values.");
  const { rotate_token, ...fields } = parsed.data;
  const update: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };
  if (rotate_token) update.sync_token = randomBytes(24).toString("hex");

  const res = await auth.supabase
    .from("profiles")
    .upsert({ user_id: auth.user.id, ...update })
    .select("*")
    .single();
  if (res.error) return bad(res.error.message, 500);
  return NextResponse.json(res.data);
}
