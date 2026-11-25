// Nutrient keys used everywhere in the app, with USDA FoodData Central nutrient numbers.

export type NutrientKey =
  | "kcal" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g" | "sugar_g" | "sat_fat_g"
  | "sodium_mg" | "potassium_mg" | "calcium_mg" | "iron_mg" | "magnesium_mg" | "zinc_mg"
  | "phosphorus_mg" | "selenium_ug"
  | "vit_a_ug" | "vit_c_mg" | "vit_d_ug" | "vit_e_mg" | "vit_k_ug"
  | "thiamin_mg" | "riboflavin_mg" | "niacin_mg" | "vit_b6_mg" | "folate_ug" | "vit_b12_ug";

export type Nutrients = Partial<Record<NutrientKey, number>>;

export const NUTRIENTS: { key: NutrientKey; label: string; unit: string; usda: string[]; group: "macro" | "mineral" | "vitamin" }[] = [
  { key: "kcal", label: "Calories", unit: "kcal", usda: ["208", "957", "958"], group: "macro" },
  { key: "protein_g", label: "Protein", unit: "g", usda: ["203"], group: "macro" },
  { key: "carbs_g", label: "Carbs", unit: "g", usda: ["205"], group: "macro" },
  { key: "fat_g", label: "Fat", unit: "g", usda: ["204"], group: "macro" },
  { key: "fiber_g", label: "Fiber", unit: "g", usda: ["291"], group: "macro" },
  { key: "sugar_g", label: "Sugars", unit: "g", usda: ["269"], group: "macro" },
  { key: "sat_fat_g", label: "Saturated fat", unit: "g", usda: ["606"], group: "macro" },
  { key: "sodium_mg", label: "Sodium", unit: "mg", usda: ["307"], group: "mineral" },
  { key: "potassium_mg", label: "Potassium", unit: "mg", usda: ["306"], group: "mineral" },
  { key: "calcium_mg", label: "Calcium", unit: "mg", usda: ["301"], group: "mineral" },
  { key: "iron_mg", label: "Iron", unit: "mg", usda: ["303"], group: "mineral" },
  { key: "magnesium_mg", label: "Magnesium", unit: "mg", usda: ["304"], group: "mineral" },
  { key: "zinc_mg", label: "Zinc", unit: "mg", usda: ["309"], group: "mineral" },
  { key: "phosphorus_mg", label: "Phosphorus", unit: "mg", usda: ["305"], group: "mineral" },
  { key: "selenium_ug", label: "Selenium", unit: "µg", usda: ["317"], group: "mineral" },
  { key: "vit_a_ug", label: "Vitamin A", unit: "µg", usda: ["320"], group: "vitamin" },
  { key: "vit_c_mg", label: "Vitamin C", unit: "mg", usda: ["401"], group: "vitamin" },
  { key: "vit_d_ug", label: "Vitamin D", unit: "µg", usda: ["328"], group: "vitamin" },
  { key: "vit_e_mg", label: "Vitamin E", unit: "mg", usda: ["323"], group: "vitamin" },
  { key: "vit_k_ug", label: "Vitamin K", unit: "µg", usda: ["430"], group: "vitamin" },
  { key: "thiamin_mg", label: "Vitamin B1 (thiamin)", unit: "mg", usda: ["404"], group: "vitamin" },
  { key: "riboflavin_mg", label: "Vitamin B2 (riboflavin)", unit: "mg", usda: ["405"], group: "vitamin" },
  { key: "niacin_mg", label: "Vitamin B3 (niacin)", unit: "mg", usda: ["406"], group: "vitamin" },
  { key: "vit_b6_mg", label: "Vitamin B6", unit: "mg", usda: ["415"], group: "vitamin" },
  { key: "folate_ug", label: "Folate", unit: "µg", usda: ["435", "417"], group: "vitamin" },
  { key: "vit_b12_ug", label: "Vitamin B12", unit: "µg", usda: ["418"], group: "vitamin" },
];

export const NUTRIENT_BY_KEY = Object.fromEntries(NUTRIENTS.map((n) => [n.key, n])) as Record<
  NutrientKey,
  (typeof NUTRIENTS)[number]
>;

export function addNutrients(a: Nutrients, b: Nutrients, factor = 1): Nutrients {
  const out: Nutrients = { ...a };
  for (const n of NUTRIENTS) {
    const v = b[n.key];
    if (typeof v === "number" && Number.isFinite(v)) out[n.key] = (out[n.key] ?? 0) + v * factor;
  }
  return out;
}

export function roundNutrients(n: Nutrients): Nutrients {
  const out: Nutrients = {};
  for (const [k, v] of Object.entries(n)) {
    if (typeof v === "number") out[k as NutrientKey] = Math.round(v * 10) / 10;
  }
  return out;
}

/** Convert a USDA search result's foodNutrients list to values per 100 g. */
export function fromUsdaNutrients(list: { nutrientNumber?: string; value?: number }[]): Nutrients {
  const byNumber = new Map<string, number>();
  for (const item of list) {
    if (item.nutrientNumber && typeof item.value === "number") byNumber.set(item.nutrientNumber, item.value);
  }
  const out: Nutrients = {};
  for (const n of NUTRIENTS) {
    for (const num of n.usda) {
      const v = byNumber.get(num);
      if (v !== undefined) {
        out[n.key] = v;
        break;
      }
    }
  }
  if (out.kcal === undefined && (out.protein_g !== undefined || out.carbs_g !== undefined || out.fat_g !== undefined)) {
    out.kcal = 4 * (out.protein_g ?? 0) + 4 * (out.carbs_g ?? 0) + 9 * (out.fat_g ?? 0);
  }
  return out;
}
