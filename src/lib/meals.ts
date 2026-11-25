import "server-only";
import { addNutrients, roundNutrients, type Nutrients } from "@/lib/nutrients";
import { lookupFood } from "@/lib/usda";

export type MealItemInput = {
  name: string;
  quantity: number;
  unit: string;
  grams_per_unit: number;
  ingredients: { usda_query: string; share: number }[];
  estimate_per_100g?: Partial<Record<"kcal" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g", number>>;
};

export type ComputedItem = {
  name: string;
  quantity: number;
  unit: string;
  grams: number;
  nutrients: Nutrients;
  sources: { query: string; share: number; fdcId?: number; description?: string; estimated?: boolean }[];
};

/** Work out nutrients for one logged item from USDA data (falling back to Claude's estimate). */
export async function computeItem(item: MealItemInput): Promise<ComputedItem> {
  const grams = Math.max(0, Number(item.quantity) * Number(item.grams_per_unit));
  const parts = item.ingredients.length ? item.ingredients : [{ usda_query: item.name, share: 1 }];
  const totalShare = parts.reduce((s, p) => s + (p.share > 0 ? p.share : 0), 0) || 1;

  let nutrients: Nutrients = {};
  const sources: ComputedItem["sources"] = [];
  let estimatedShare = 0;

  for (const p of parts) {
    const share = (p.share > 0 ? p.share : 0) / totalShare;
    const match = await lookupFood(p.usda_query);
    if (match) {
      nutrients = addNutrients(nutrients, match.per100g, (grams * share) / 100);
      sources.push({ query: p.usda_query, share, fdcId: match.fdcId, description: match.description });
    } else {
      estimatedShare += share;
      sources.push({ query: p.usda_query, share, estimated: true });
    }
  }

  if (estimatedShare > 0 && item.estimate_per_100g) {
    nutrients = addNutrients(nutrients, item.estimate_per_100g as Nutrients, (grams * estimatedShare) / 100);
  }

  return { name: item.name, quantity: item.quantity, unit: item.unit, grams: Math.round(grams), nutrients: roundNutrients(nutrients), sources };
}
