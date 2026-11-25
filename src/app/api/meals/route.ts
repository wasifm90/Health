import { NextResponse } from "next/server";
import { z } from "zod";
import { computeItem } from "@/lib/meals";
import { bad, errorMessage } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";
import { localDate } from "@/lib/time";

export const maxDuration = 60;

const Item = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().positive().max(10000),
  unit: z.string().min(1).max(40),
  grams_per_unit: z.number().positive().max(5000),
  ingredients: z.array(z.object({ usda_query: z.string().min(1).max(200), share: z.number().min(0).max(1) })).max(15),
  estimate_per_100g: z.record(z.string(), z.number()).optional(),
});
const Body = z.object({
  eaten_at: z.string().datetime({ offset: true }).optional(),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
  photo_path: z.string().max(300).optional(),
  note: z.string().max(1000).optional(),
  items: z.array(Item).min(1).max(30),
});

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth) return bad("Not signed in", 401);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Please check the food items and quantities.");
  const { supabase, user } = auth;
  const b = parsed.data;

  if (b.photo_path && !b.photo_path.startsWith(`${user.id}/`)) return bad("Invalid photo");

  try {
    const computed = await Promise.all(b.items.map((i) => computeItem(i)));
    const eatenAt = b.eaten_at ? new Date(b.eaten_at) : new Date();

    const meal = await supabase
      .from("meals")
      .insert({
        user_id: user.id,
        eaten_at: eatenAt.toISOString(),
        local_date: localDate(eatenAt),
        meal_type: b.meal_type ?? null,
        photo_path: b.photo_path ?? null,
        note: b.note ?? null,
      })
      .select("id, local_date")
      .single();
    if (meal.error) throw meal.error;

    const rows = computed.map((c) => ({ ...c, meal_id: meal.data.id, user_id: user.id }));
    const items = await supabase.from("meal_items").insert(rows).select("id, name, quantity, unit, grams, nutrients, sources");
    if (items.error) throw items.error;

    return NextResponse.json({ meal: meal.data, items: items.data });
  } catch (e) {
    console.error(e);
    return bad(errorMessage(e), 500);
  }
}

export async function DELETE(req: Request) {
  const auth = await requireUser();
  if (!auth) return bad("Not signed in", 401);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("Missing id");
  const { data } = await auth.supabase.from("meals").select("photo_path").eq("id", id).maybeSingle();
  const res = await auth.supabase.from("meals").delete().eq("id", id);
  if (res.error) return bad(res.error.message, 500);
  if (data?.photo_path) await auth.supabase.storage.from("photos").remove([data.photo_path]);
  return NextResponse.json({ ok: true });
}
