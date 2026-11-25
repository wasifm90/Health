"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PhotoPicker } from "@/components/PhotoPicker";
import { createClient } from "@/lib/supabase/client";
import { postJson, prepareImage, type PreparedImage } from "@/lib/image";

type Ingredient = { usda_query: string; share: number };
type Item = {
  key: string;
  name: string;
  confidence: "high" | "medium" | "low";
  unit: string;
  grams_per_unit: number;
  quantity: number;
  ingredients: Ingredient[];
  estimate_per_100g?: Record<string, number>;
  ask_cooking_fat?: boolean;
};
type IdentifyResult = {
  is_food: boolean;
  note: string;
  items: (Omit<Item, "key" | "quantity"> & { suggested_quantity: number })[];
};
type SavedItem = { name: string; quantity: number; unit: string; grams: number; nutrients: Record<string, number> };

const UNITS = ["g", "piece", "slice", "cup", "bowl", "plate", "tbsp", "tsp", "glass", "ml"];
const OIL: Omit<Item, "key"> = {
  name: "Cooking oil / ghee",
  confidence: "medium",
  unit: "tbsp",
  grams_per_unit: 13.6,
  quantity: 1,
  ingredients: [{ usda_query: "oil, vegetable", share: 1 }],
  estimate_per_100g: { kcal: 884, protein_g: 0, carbs_g: 0, fat_g: 100, fiber_g: 0 },
};

function defaultMealType() {
  const h = new Date().getHours();
  return h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 22 ? "dinner" : "snack";
}
const uid = () => Math.random().toString(36).slice(2);

export function FoodLogger() {
  const router = useRouter();
  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  const [text, setText] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [note, setNote] = useState("");
  const [mealType, setMealType] = useState(defaultMealType());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedItem[] | null>(null);

  async function onFiles(files: File[]) {
    setError(null);
    try {
      setBusy("Preparing photo…");
      const img = await prepareImage(files[0]);
      setPhoto(img);
      await identify(img, text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the photo.");
    } finally {
      setBusy(null);
    }
  }

  async function identify(img: PreparedImage | null, desc: string) {
    setError(null);
    setBusy("Identifying food…");
    try {
      const res = await postJson<IdentifyResult>("/api/food/identify", {
        image: img ? { data: img.data, mediaType: img.mediaType } : undefined,
        text: desc || undefined,
      });
      if (!res.is_food || !res.items.length) {
        setItems([]);
        setNote(res.note || "No food found. Try another photo, or type what you ate.");
      } else {
        setItems(res.items.map((i) => ({ ...i, key: uid(), quantity: i.suggested_quantity || 1 })));
        setNote(res.note);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not identify the food.");
    } finally {
      setBusy(null);
    }
  }

  function update(key: string, patch: Partial<Item>) {
    setItems((list) => list?.map((i) => (i.key === key ? { ...i, ...patch } : i)) ?? null);
  }

  async function save() {
    if (!items?.length) return;
    setBusy("Calculating nutrients…");
    setError(null);
    try {
      let photo_path: string | undefined;
      if (photo) {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          const path = `${data.user.id}/meals/${Date.now()}-${uid()}.jpg`;
          const up = await supabase.storage.from("photos").upload(path, photo.blob, { contentType: "image/jpeg" });
          if (!up.error) photo_path = path;
        }
      }
      const res = await postJson<{ items: SavedItem[] }>("/api/meals", {
        meal_type: mealType,
        photo_path,
        items: items.map((i) => ({
          name: i.name,
          quantity: Number(i.quantity),
          unit: i.unit,
          grams_per_unit: i.unit === "g" || i.unit === "ml" ? 1 : Number(i.grams_per_unit),
          ingredients: i.ingredients,
          estimate_per_100g: i.estimate_per_100g,
        })),
      });
      setSaved(res.items);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saving failed.");
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    setPhoto(null);
    setText("");
    setItems(null);
    setNote("");
    setSaved(null);
    setError(null);
  }

  if (saved) {
    const kcal = saved.reduce((s, i) => s + (i.nutrients.kcal ?? 0), 0);
    const p = saved.reduce((s, i) => s + (i.nutrients.protein_g ?? 0), 0);
    const c = saved.reduce((s, i) => s + (i.nutrients.carbs_g ?? 0), 0);
    const f = saved.reduce((s, i) => s + (i.nutrients.fat_g ?? 0), 0);
    const fib = saved.reduce((s, i) => s + (i.nutrients.fiber_g ?? 0), 0);
    return (
      <div className="card space-y-3">
        <h2 className="text-lg font-semibold text-emerald-700">✅ Saved</h2>
        <div className="grid grid-cols-5 gap-1 text-center text-xs">
          {[["kcal", kcal], ["Protein", p], ["Carbs", c], ["Fat", f], ["Fiber", fib]].map(([l, v]) => (
            <div key={l as string} className="rounded-lg bg-neutral-50 py-2">
              <div className="text-base font-semibold tabular-nums">{Math.round(v as number)}</div>
              <div className="text-neutral-500">{l}{l === "kcal" ? "" : " g"}</div>
            </div>
          ))}
        </div>
        <ul className="text-sm text-neutral-600">
          {saved.map((i, n) => (
            <li key={n}>{i.quantity} {i.unit} {i.name} · {i.grams} g · {Math.round(i.nutrients.kcal ?? 0)} kcal</li>
          ))}
        </ul>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" onClick={reset}>Log another</button>
          <button className="btn-secondary flex-1" onClick={() => router.push("/")}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!items && (
        <>
          <PhotoPicker onFiles={onFiles} label="Take a photo of your meal — the app will recognise the food" />
          <div className="card space-y-2">
            <label className="label" htmlFor="desc">…or type what you ate</label>
            <textarea id="desc" className="input min-h-20" placeholder="e.g. 2 eggs, 1 khubz, a cup of laban" value={text} onChange={(e) => setText(e.target.value)} />
            <button className="btn-secondary w-full" disabled={!text.trim() || !!busy} onClick={() => identify(null, text)}>Find foods</button>
          </div>
        </>
      )}

      {busy && <p className="card animate-pulse text-center text-sm text-neutral-600">{busy}</p>}
      {error && <p className="card bg-rose-50 text-sm text-rose-800">{error}</p>}

      {items && (
        <div className="space-y-3">
          {photo && <img src={photo.previewUrl} alt="Your meal" className="max-h-64 w-full rounded-2xl object-cover" />}
          {note && <p className="text-sm text-neutral-600">{note}</p>}

          <div className="card space-y-1">
            <label className="label">Meal</label>
            <div className="flex flex-wrap gap-2">
              {["breakfast", "lunch", "dinner", "snack"].map((m) => (
                <button key={m} type="button" onClick={() => setMealType(m)}
                  className={`rounded-full px-3 py-1 text-sm capitalize ring-1 ${mealType === m ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white ring-neutral-200"}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {items.map((i) => (
            <div key={i.key} className="card space-y-2">
              <div className="flex items-start gap-2">
                <input className="input font-medium" value={i.name} onChange={(e) => update(i.key, { name: e.target.value })} aria-label="Food name" />
                <button className="px-2 text-xl text-neutral-400" aria-label="Remove" onClick={() => setItems(items.filter((x) => x.key !== i.key))}>×</button>
              </div>
              {i.confidence !== "high" && (
                <p className="text-xs text-amber-700">{i.confidence === "low" ? "Not sure about this one — please check the name." : "Probably right — please check."}</p>
              )}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label">Quantity</label>
                  <input className="input tabular-nums" type="number" inputMode="decimal" min={0} step="any" value={i.quantity}
                    onChange={(e) => update(i.key, { quantity: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="label">Unit</label>
                  <select className="input" value={i.unit} onChange={(e) => update(i.key, { unit: e.target.value })}>
                    {[...new Set([i.unit, ...UNITS])].map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Grams / unit</label>
                  <input className="input tabular-nums" type="number" inputMode="decimal" min={0} step="any"
                    disabled={i.unit === "g" || i.unit === "ml"}
                    value={i.unit === "g" || i.unit === "ml" ? 1 : i.grams_per_unit}
                    onChange={(e) => update(i.key, { grams_per_unit: Number(e.target.value) })} />
                </div>
              </div>
              <p className="text-xs text-neutral-500">
                ≈ {Math.round(i.quantity * (i.unit === "g" || i.unit === "ml" ? 1 : i.grams_per_unit))} g
                {i.ingredients.length > 1 && ` · ${i.ingredients.map((g) => g.usda_query).join(", ")}`}
              </p>
            </div>
          ))}

          {items.some((i) => i.ask_cooking_fat) && !items.some((i) => i.name === OIL.name) && (
            <button className="btn-secondary w-full" onClick={() => setItems([...items, { ...OIL, key: uid() }])}>
              🫒 Cooked with extra oil or ghee? Add 1 tbsp
            </button>
          )}
          <button className="btn-secondary w-full" onClick={() =>
            setItems([...items, { key: uid(), name: "", confidence: "high", unit: "g", grams_per_unit: 1, quantity: 100, ingredients: [] }])}>
            + Add item
          </button>

          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={reset} disabled={!!busy}>Start over</button>
            <button className="btn-primary flex-[2]" onClick={save} disabled={!!busy || !items.length || items.some((i) => !i.name.trim() || !(i.quantity > 0))}>
              Save meal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
