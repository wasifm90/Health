import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateDay } from "@/lib/evaluate";
import { computeTargets } from "@/lib/targets";
import { parseHealthExport } from "@/lib/healthSync";
import { fromUsdaNutrients } from "@/lib/nutrients";

const profile = { sex: "male" as const, birth_year: 1990, height_cm: 175, weight_kg: 80, activity_level: "light" as const, goal: "lose" as const };

test("targets are sensible", () => {
  const t = computeTargets(profile, { year: 2026 });
  assert.ok(t.kcal > 1800 && t.kcal < 2600, `kcal ${t.kcal}`);
  assert.equal(t.protein_g, 128);
  assert.ok(t.fiber_g >= 25);
});

test("no meals is a red flag; good protein is green", () => {
  const t = computeTargets(profile, { year: 2026 });
  assert.equal(evaluateDay({ totals: {}, mealCount: 0, metrics: {}, inbody: null, sex: "male" }, t)[0].status, "red");
  const flags = evaluateDay({ totals: { kcal: t.kcal, protein_g: 130, fiber_g: 10, sodium_mg: 4000 }, mealCount: 3, metrics: { step_count: 9000 }, inbody: { percent_body_fat: 27, visceral_fat_level: 9 }, sex: "male" }, t);
  const by = Object.fromEntries(flags.map((f) => [f.key, f.status]));
  assert.equal(by.kcal, "green");
  assert.equal(by.protein_g, "green");
  assert.equal(by.fiber_g, "red");
  assert.equal(by.sodium_mg, "red");
  assert.equal(by.steps, "green");
  assert.equal(by.pbf, "red");
  assert.equal(by.vfl, "green");
});

test("Health Auto Export payload is aggregated per day", () => {
  const rows = parseHealthExport({
    data: {
      metrics: [
        { name: "step_count", units: "count", data: [{ date: "2026-11-24 08:00:00 +0300", qty: 4000 }, { date: "2026-11-24 18:00:00 +0300", qty: 3000 }] },
        { name: "sleep_analysis", units: "hr", data: [{ date: "2026-11-24 00:00:00 +0300", totalSleep: 6.5 }] },
        { name: "heart_rate", units: "count/min", data: [{ date: "2026-11-24 00:00:00 +0300", Min: 50, Avg: 70, Max: 120 }] },
      ],
    },
  });
  const by = Object.fromEntries(rows.map((r) => [r.metric, r.value]));
  assert.equal(by.step_count, 7000);
  assert.equal(by.sleep_hours, 6.5);
  assert.equal(by.heart_rate, 70);
});

test("USDA nutrient numbers map to keys", () => {
  const n = fromUsdaNutrients([{ nutrientNumber: "203", value: 20 }, { nutrientNumber: "204", value: 5 }, { nutrientNumber: "205", value: 0 }, { nutrientNumber: "301", value: 12 }]);
  assert.equal(n.protein_g, 20);
  assert.equal(n.calcium_mg, 12);
  assert.equal(n.kcal, 125);
});
