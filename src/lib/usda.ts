import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fromUsdaNutrients, type Nutrients } from "@/lib/nutrients";

export type UsdaMatch = { fdcId: number; description: string; per100g: Nutrients };

const memo = new Map<string, UsdaMatch | null>();

/** Find the best USDA FoodData Central match for a plain-English food query (values per 100 g). */
export async function lookupFood(rawQuery: string): Promise<UsdaMatch | null> {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return null;
  if (memo.has(query)) return memo.get(query)!;

  const admin = createAdminClient();
  const cached = await admin.from("food_cache").select("fdc_id, description, per100g").eq("query", query).maybeSingle();
  if (cached.data) {
    const hit = cached.data.fdc_id
      ? { fdcId: Number(cached.data.fdc_id), description: cached.data.description ?? query, per100g: cached.data.per100g as Nutrients }
      : null;
    memo.set(query, hit);
    return hit;
  }

  const key = process.env.USDA_API_KEY;
  if (!key) return null;

  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("query", query);
  url.searchParams.set("dataType", "Foundation,SR Legacy,Survey (FNDDS)");
  url.searchParams.set("pageSize", "5");

  const res = await fetch(url, { headers: { "X-Api-Key": key }, cache: "no-store" });
  if (!res.ok) {
    console.error("USDA lookup failed", res.status, query);
    return null;
  }
  const body = (await res.json()) as {
    foods?: { fdcId: number; description: string; foodNutrients?: { nutrientNumber?: string; value?: number }[] }[];
  };
  const food = body.foods?.find((f) => (f.foodNutrients?.length ?? 0) > 5) ?? body.foods?.[0];
  const match = food
    ? { fdcId: food.fdcId, description: food.description, per100g: fromUsdaNutrients(food.foodNutrients ?? []) }
    : null;

  memo.set(query, match);
  await admin.from("food_cache").upsert({
    query,
    fdc_id: match?.fdcId ?? null,
    description: match?.description ?? null,
    per100g: match?.per100g ?? null,
  });
  return match;
}
