// Pure scoring logic: turns a day's totals into green / amber / red flags.
import { NUTRIENT_BY_KEY, type NutrientKey, type Nutrients } from "@/lib/nutrients";
import type { Targets } from "@/lib/targets";

export type FlagStatus = "green" | "amber" | "red";
export type Flag = {
  area: "nutrition" | "micronutrient" | "activity" | "sleep" | "body";
  key: string;
  label: string;
  status: FlagStatus;
  value: number | null;
  target: string;
  unit: string;
  message: string;
};

export type DayInput = {
  totals: Nutrients;
  mealCount: number;
  metrics: Record<string, number>;
  inbody: { percent_body_fat?: number | null; visceral_fat_level?: number | null; scan_date?: string } | null;
  sex: "male" | "female" | null;
};

const r = (n: number) => Math.round(n);

function minTarget(key: NutrientKey, value: number, target: number, area: Flag["area"]): Flag {
  const meta = NUTRIENT_BY_KEY[key];
  const ratio = target > 0 ? value / target : 1;
  const status: FlagStatus = ratio >= 0.9 ? "green" : ratio >= 0.7 ? "amber" : "red";
  const message =
    status === "green"
      ? `${meta.label} on target (${r(ratio * 100)}%).`
      : `${meta.label} at ${r(ratio * 100)}% of target — about ${r(target - value)} ${meta.unit} short.`;
  return { area, key, label: meta.label, status, value: r(value * 10) / 10, target: `≥ ${target} ${meta.unit}`, unit: meta.unit, message };
}

function maxLimit(key: NutrientKey, value: number, limit: number): Flag {
  const meta = NUTRIENT_BY_KEY[key];
  const ratio = limit > 0 ? value / limit : 0;
  const status: FlagStatus = ratio <= 1 ? "green" : ratio <= 1.3 ? "amber" : "red";
  const message =
    status === "green"
      ? `${meta.label} within limit.`
      : `${meta.label} ${r(value - limit)} ${meta.unit} over the ${limit} ${meta.unit} limit.`;
  return { area: "nutrition", key, label: meta.label, status, value: r(value), target: `≤ ${limit} ${meta.unit}`, unit: meta.unit, message };
}

export function evaluateDay(input: DayInput, t: Targets): Flag[] {
  const flags: Flag[] = [];
  const v = (k: NutrientKey) => input.totals[k] ?? 0;

  if (input.mealCount === 0) {
    flags.push({
      area: "nutrition", key: "no_meals", label: "Food log", status: "red", value: 0, target: "log every meal", unit: "",
      message: "No meals were logged, so nutrition can't be checked.",
    });
  } else {
    // Calories: within ±10% is green.
    const kcal = v("kcal");
    const ratio = kcal / t.kcal;
    const kStatus: FlagStatus = ratio >= 0.9 && ratio <= 1.1 ? "green" : ratio >= 0.8 && ratio <= 1.2 ? "amber" : "red";
    flags.push({
      area: "nutrition", key: "kcal", label: "Calories", status: kStatus, value: r(kcal), target: `${t.kcal} kcal`, unit: "kcal",
      message: kStatus === "green" ? "Calories on target." : `Calories ${ratio < 1 ? "under" : "over"} target by ${Math.abs(r(kcal - t.kcal))} kcal.`,
    });

    flags.push(minTarget("protein_g", v("protein_g"), t.protein_g, "nutrition"));
    flags.push(minTarget("fiber_g", v("fiber_g"), t.fiber_g, "nutrition"));

    const fat = v("fat_g");
    const fStatus: FlagStatus = fat >= t.fat_g_min && fat <= t.fat_g_max ? "green" : fat >= t.fat_g_min * 0.8 && fat <= t.fat_g_max * 1.2 ? "amber" : "red";
    flags.push({
      area: "nutrition", key: "fat_g", label: "Fat", status: fStatus, value: r(fat), target: `${t.fat_g_min}–${t.fat_g_max} g`, unit: "g",
      message: fStatus === "green" ? "Fat in a healthy range." : `Fat ${fat < t.fat_g_min ? "below" : "above"} the ${t.fat_g_min}–${t.fat_g_max} g range.`,
    });

    const carbs = v("carbs_g");
    const cRatio = carbs / t.carbs_g;
    const cStatus: FlagStatus = cRatio >= 0.75 && cRatio <= 1.25 ? "green" : cRatio >= 0.5 && cRatio <= 1.5 ? "amber" : "red";
    flags.push({
      area: "nutrition", key: "carbs_g", label: "Carbs", status: cStatus, value: r(carbs), target: `~${t.carbs_g} g`, unit: "g",
      message: cStatus === "green" ? "Carbs about right." : `Carbs ${cRatio < 1 ? "low" : "high"} (${r(cRatio * 100)}% of target).`,
    });

    flags.push(maxLimit("sodium_mg", v("sodium_mg"), t.sodium_mg_max));
    flags.push(maxLimit("sat_fat_g", v("sat_fat_g"), t.sat_fat_g_max));
    if (input.totals.sugar_g !== undefined) {
      const f = maxLimit("sugar_g", v("sugar_g"), t.sugar_g_max * 2);
      f.message = f.status === "green" ? "Total sugars reasonable." : `${f.message} (includes natural sugars from fruit and milk).`;
      flags.push(f);
    }

    for (const [key, target] of Object.entries(t.micros) as [NutrientKey, number][]) {
      flags.push(minTarget(key, v(key), target, "micronutrient"));
    }
  }

  // Apple Health
  const steps = input.metrics.step_count;
  if (steps !== undefined) {
    const s: FlagStatus = steps >= 8000 ? "green" : steps >= 5000 ? "amber" : "red";
    flags.push({ area: "activity", key: "steps", label: "Steps", status: s, value: r(steps), target: "≥ 8,000", unit: "steps",
      message: s === "green" ? "Great step count." : `${r(8000 - steps)} steps short of 8,000.` });
  }
  const sleep = input.metrics.sleep_hours;
  if (sleep !== undefined) {
    const s: FlagStatus = sleep >= 7 ? "green" : sleep >= 6 ? "amber" : "red";
    flags.push({ area: "sleep", key: "sleep", label: "Sleep", status: s, value: Math.round(sleep * 10) / 10, target: "7–9 h", unit: "h",
      message: s === "green" ? "Enough sleep." : `Only ${Math.round(sleep * 10) / 10} h of sleep.` });
  }
  const exercise = input.metrics.apple_exercise_time;
  if (exercise !== undefined) {
    const s: FlagStatus = exercise >= 30 ? "green" : exercise >= 15 ? "amber" : "red";
    flags.push({ area: "activity", key: "exercise", label: "Exercise minutes", status: s, value: r(exercise), target: "≥ 30 min", unit: "min",
      message: s === "green" ? "Exercise goal met." : `${r(30 - exercise)} min short of 30 minutes.` });
  }

  // InBody (latest scan)
  if (input.inbody) {
    const pbf = input.inbody.percent_body_fat;
    if (typeof pbf === "number") {
      const [g, a] = input.sex === "female" ? [28, 33] : [20, 25];
      const low = input.sex === "female" ? 15 : 8;
      const s: FlagStatus = pbf < low ? "amber" : pbf <= g ? "green" : pbf <= a ? "amber" : "red";
      flags.push({ area: "body", key: "pbf", label: "Body fat %", status: s, value: pbf, target: `${low}–${g}%`, unit: "%",
        message: s === "green" ? "Body fat in a healthy range." : pbf < low ? "Body fat is quite low." : `Body fat ${Math.round((pbf - g) * 10) / 10} points above ${g}%.` });
    }
    const vfl = input.inbody.visceral_fat_level;
    if (typeof vfl === "number") {
      const s: FlagStatus = vfl < 10 ? "green" : vfl < 15 ? "amber" : "red";
      flags.push({ area: "body", key: "vfl", label: "Visceral fat level", status: s, value: vfl, target: "< 10", unit: "",
        message: s === "green" ? "Visceral fat in the healthy range." : `Visceral fat level ${vfl} (aim below 10).` });
    }
  }

  return flags;
}

// Simple food-source tips used when Claude isn't available.
export const FALLBACK_TIPS: Record<string, string> = {
  no_meals: "Log each meal with a quick photo — it takes 10 seconds and makes the report accurate.",
  kcal: "Adjust portions of rice, bread and sweets first; keep protein and vegetables steady.",
  protein_g: "Add a palm-sized portion of chicken, fish, eggs, Greek yogurt, laban or lentils to each meal.",
  fiber_g: "Add vegetables or salad to lunch and dinner, choose whole-wheat bread, and snack on fruit or dates with nuts.",
  fat_g: "Use measured oil (1 tbsp per dish) and include nuts, olive oil, avocado or fish for healthy fats.",
  carbs_g: "Match carbs to activity: a fist-sized portion of rice or 1–2 bread per meal is a good default.",
  sodium_mg: "Cut back on pickles, processed cheese, instant noodles, chips and restaurant sauces; drink more water.",
  sat_fat_g: "Swap ghee/butter for olive oil and choose lean meats over fatty cuts or fried food.",
  sugar_g: "Limit sweet drinks, juices and desserts; have whole fruit instead.",
  potassium_mg: "Bananas, potatoes, dates, laban, beans and leafy greens are rich in potassium.",
  calcium_mg: "Milk, laban, yogurt, cheese, sesame (tahini) and almonds add calcium.",
  iron_mg: "Red meat, liver, lentils, chickpeas and spinach add iron — have them with vitamin C (lemon, peppers).",
  magnesium_mg: "Nuts, seeds, whole grains, beans and dark chocolate add magnesium.",
  zinc_mg: "Meat, chicken, chickpeas, cashews and pumpkin seeds add zinc.",
  vit_d_ug: "Get 10–20 minutes of sun on arms, and eat oily fish and eggs; a supplement may help — ask your doctor.",
  vit_c_mg: "Oranges, guava, kiwi, peppers and tomatoes are rich in vitamin C.",
  vit_a_ug: "Carrots, sweet potato, spinach and eggs add vitamin A.",
  folate_ug: "Leafy greens, lentils, chickpeas and oranges add folate.",
  vit_b12_ug: "Meat, fish, eggs and dairy provide B12.",
  steps: "Add a 20-minute walk after a main meal, or take calls while walking.",
  exercise: "Aim for 30 minutes of brisk walking, gym or sport most days.",
  sleep: "Keep a fixed bedtime, avoid screens for 30 minutes before bed, and limit caffeine after Asr.",
  pbf: "Keep protein high, stay in a small calorie deficit, and add 2–3 strength sessions a week.",
  vfl: "Regular cardio, fewer sugary drinks and refined carbs, and better sleep reduce visceral fat.",
};
