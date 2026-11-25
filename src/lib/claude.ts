import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  client ??= new Anthropic();
  return client;
}

export type ImageInput = { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };

function imageBlock(img: ImageInput): Anthropic.ImageBlockParam {
  return { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } };
}

async function parse<T extends z.ZodType>(schema: T, system: string, content: Anthropic.ContentBlockParam[], effort: "low" | "medium" = "low") {
  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system,
    output_config: { effort, format: zodOutputFormat(schema) },
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal") throw new Error("The request was declined. Please try a different photo.");
  if (!response.parsed_output) throw new Error("Could not read a result. Please try again.");
  return response.parsed_output as z.infer<T>;
}

// ---------- Food identification ----------

export const FoodItemSchema = z.object({
  name: z.string().describe("Short dish or food name as a person would say it, e.g. 'Chicken biryani'"),
  confidence: z.enum(["high", "medium", "low"]),
  unit: z.string().describe("Natural unit for this food: g, piece, slice, cup, bowl, plate, tbsp, tsp, glass, ml"),
  grams_per_unit: z.number().describe("Typical grams (or ml for drinks) in ONE of that unit"),
  suggested_quantity: z.number().describe("How many units appear in the photo/description"),
  ingredients: z
    .array(
      z.object({
        usda_query: z.string().describe("Simple USDA FoodData Central search term, e.g. 'rice, white, cooked'"),
        share: z.number().describe("Fraction of the item's weight, 0-1; all shares sum to 1"),
      }),
    )
    .describe("One entry for a simple food; the usual components for a mixed dish"),
  estimate_per_100g: z
    .object({ kcal: z.number(), protein_g: z.number(), carbs_g: z.number(), fat_g: z.number(), fiber_g: z.number() })
    .describe("Your best estimate per 100 g, used only if the database has no match"),
  ask_cooking_fat: z.boolean().describe("True if oil/ghee/butter used in cooking would matter and can't be seen"),
});
export type FoodItem = z.infer<typeof FoodItemSchema>;

const FoodResultSchema = z.object({
  is_food: z.boolean(),
  items: z.array(FoodItemSchema),
  note: z.string().describe("One short sentence for the user, or empty"),
});

const FOOD_SYSTEM = `You identify foods for a personal nutrition log. The user is in Saudi Arabia and may eat Middle Eastern, South Asian and international food.
List each distinct food or drink separately (e.g. rice dish, side salad, yogurt, bread, drink). Use common names.
For mixed dishes, break them into their usual ingredients with weight shares so nutrients can be looked up, including typical cooking oil or ghee.
Choose a natural unit and a realistic grams_per_unit (e.g. 1 roti ~ 40 g, 1 cup cooked rice ~ 160 g, 1 medium date ~ 8 g, 1 bowl dal ~ 200 g).
Estimate the quantity visible; the user will correct it. If the photo is not food, set is_food to false and return no items.`;

export async function identifyFood(input: { image?: ImageInput; text?: string }) {
  const content: Anthropic.ContentBlockParam[] = [];
  if (input.image) content.push(imageBlock(input.image));
  content.push({
    type: "text",
    text: input.text?.trim()
      ? `What I ate: ${input.text.trim()}`
      : "Identify the foods in this photo.",
  });
  return parse(FoodResultSchema, FOOD_SYSTEM, content);
}

// ---------- InBody sheet ----------

const num = z.number().nullable();
export const InBodySchema = z.object({
  is_inbody: z.boolean().describe("True if this is a body composition result sheet or screen"),
  scan_date: z.string().describe("YYYY-MM-DD if printed on the sheet, else empty"),
  weight_kg: num,
  skeletal_muscle_mass_kg: num,
  body_fat_mass_kg: num,
  percent_body_fat: num,
  bmi: num,
  visceral_fat_level: num,
  bmr_kcal: num,
  total_body_water_l: num,
  protein_kg: num,
  minerals_kg: num,
  inbody_score: num,
  waist_hip_ratio: num,
  target_weight_kg: num,
  fat_control_kg: num,
  muscle_control_kg: num,
  segmental_notes: z.string().describe("Short summary of segmental lean/fat analysis if shown, else empty"),
});
export type InBodyData = z.infer<typeof InBodySchema>;

export async function extractInBody(images: ImageInput[]) {
  return parse(
    InBodySchema,
    "You read InBody (or similar body composition) result sheets accurately. Copy numbers exactly as printed, converting lb to kg if needed. Use null for anything not shown. Never guess values.",
    [...images.map(imageBlock), { type: "text", text: "Extract the values from this InBody result." }],
    "medium",
  );
}

// ---------- Report suggestions ----------

const SuggestionSchema = z.object({
  headline: z.string().describe("One encouraging sentence summarising the day"),
  suggestions: z
    .array(z.object({ title: z.string(), detail: z.string() }))
    .describe("3-6 practical, specific suggestions to fix the red and amber flags, with food examples and amounts"),
});
export type Suggestions = z.infer<typeof SuggestionSchema>;

export async function writeSuggestions(summary: string) {
  return parse(
    SuggestionSchema,
    `You are a practical nutrition coach writing a short daily report for one adult in Saudi Arabia.
Focus on the red flags first, then amber. Suggest specific, locally available foods with rough amounts (e.g. "150 g grilled chicken", "1 cup laban", "a handful of almonds").
Keep each suggestion to one or two sentences. Do not diagnose medical conditions; for anything that looks medically concerning, suggest checking with a doctor.`,
    [{ type: "text", text: summary }],
  );
}
