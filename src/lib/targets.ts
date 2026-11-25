import type { NutrientKey } from "@/lib/nutrients";

export type Profile = {
  sex: "male" | "female" | null;
  birth_year: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: "sedentary" | "light" | "moderate" | "active" | "very_active";
  goal: "lose" | "maintain" | "gain";
};

const ACTIVITY: Record<Profile["activity_level"], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Adult reference intakes (US National Academies RDA/AI, ages 19-50).
const MICROS: Partial<Record<NutrientKey, { male: number; female: number }>> = {
  potassium_mg: { male: 3400, female: 2600 },
  calcium_mg: { male: 1000, female: 1000 },
  iron_mg: { male: 8, female: 18 },
  magnesium_mg: { male: 420, female: 320 },
  zinc_mg: { male: 11, female: 8 },
  phosphorus_mg: { male: 700, female: 700 },
  selenium_ug: { male: 55, female: 55 },
  vit_a_ug: { male: 900, female: 700 },
  vit_c_mg: { male: 90, female: 75 },
  vit_d_ug: { male: 15, female: 15 },
  vit_e_mg: { male: 15, female: 15 },
  vit_k_ug: { male: 120, female: 90 },
  thiamin_mg: { male: 1.2, female: 1.1 },
  riboflavin_mg: { male: 1.3, female: 1.1 },
  niacin_mg: { male: 16, female: 14 },
  vit_b6_mg: { male: 1.3, female: 1.3 },
  folate_ug: { male: 400, female: 400 },
  vit_b12_ug: { male: 2.4, female: 2.4 },
};

export type Targets = {
  bmr: number;
  tdee: number;
  kcal: number;
  protein_g: number;
  fat_g_min: number;
  fat_g_max: number;
  carbs_g: number;
  fiber_g: number;
  sodium_mg_max: number;
  sat_fat_g_max: number;
  sugar_g_max: number;
  micros: Partial<Record<NutrientKey, number>>;
  assumptions: string[];
};

export function computeTargets(profile: Profile, opts: { weightKg?: number | null; bmrKcal?: number | null; year?: number }): Targets {
  const assumptions: string[] = [];
  const sex = profile.sex ?? "male";
  if (!profile.sex) assumptions.push("Sex not set in Settings; male reference values used.");

  const weight = opts.weightKg ?? profile.weight_kg ?? 75;
  if (!opts.weightKg && !profile.weight_kg) assumptions.push("Weight not set; 75 kg assumed.");
  const height = profile.height_cm ?? (sex === "male" ? 172 : 160);
  if (!profile.height_cm) assumptions.push("Height not set; average height assumed.");
  const age = profile.birth_year ? (opts.year ?? new Date().getFullYear()) - profile.birth_year : 35;
  if (!profile.birth_year) assumptions.push("Birth year not set; age 35 assumed.");

  const mifflin = 10 * weight + 6.25 * height - 5 * age + (sex === "male" ? 5 : -161);
  const bmr = opts.bmrKcal && opts.bmrKcal > 800 ? opts.bmrKcal : mifflin;
  const tdee = bmr * ACTIVITY[profile.activity_level];
  const kcal = profile.goal === "lose" ? tdee * 0.85 : profile.goal === "gain" ? tdee * 1.1 : tdee;

  const proteinPerKg = profile.goal === "maintain" ? 1.2 : 1.6;
  const protein_g = weight * proteinPerKg;
  const fat_g_min = (kcal * 0.2) / 9;
  const fat_g_max = (kcal * 0.35) / 9;
  const fatMid = (kcal * 0.28) / 9;
  const carbs_g = Math.max(100, (kcal - protein_g * 4 - fatMid * 9) / 4);
  const fiber_g = Math.max(25, (kcal / 1000) * 14);

  const micros: Partial<Record<NutrientKey, number>> = {};
  for (const [k, v] of Object.entries(MICROS)) micros[k as NutrientKey] = v[sex];

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    kcal: Math.round(kcal),
    protein_g: Math.round(protein_g),
    fat_g_min: Math.round(fat_g_min),
    fat_g_max: Math.round(fat_g_max),
    carbs_g: Math.round(carbs_g),
    fiber_g: Math.round(fiber_g),
    sodium_mg_max: 2300,
    sat_fat_g_max: Math.round((kcal * 0.1) / 9),
    sugar_g_max: Math.round((kcal * 0.1) / 4),
    micros,
    assumptions,
  };
}
