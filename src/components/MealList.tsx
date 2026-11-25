"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Meal = {
  id: string;
  eaten_at: string;
  meal_type: string | null;
  meal_items: { id: string; name: string; quantity: number; unit: string; grams: number; nutrients: Record<string, number> }[];
};

export function MealList({ meals }: { meals: Meal[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  if (!meals.length) return <p className="text-sm text-neutral-500">Nothing logged yet today.</p>;

  async function remove(id: string) {
    if (!confirm("Delete this meal?")) return;
    setBusy(id);
    await fetch(`/api/meals?id=${id}`, { method: "DELETE" });
    setBusy(null);
    router.refresh();
  }

  return (
    <ul className="divide-y divide-neutral-100">
      {meals.map((m) => {
        const kcal = m.meal_items.reduce((s, i) => s + (i.nutrients?.kcal ?? 0), 0);
        const protein = m.meal_items.reduce((s, i) => s + (i.nutrients?.protein_g ?? 0), 0);
        return (
          <li key={m.id} className="py-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium capitalize">
                {m.meal_type ?? "Meal"} · {new Date(m.eaten_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="tabular-nums text-neutral-600">{Math.round(kcal)} kcal · {Math.round(protein)} g protein</span>
            </div>
            <p className="text-sm text-neutral-500">
              {m.meal_items.map((i) => `${i.quantity} ${i.unit} ${i.name}`).join(", ")}
            </p>
            <button className="text-xs text-rose-600" disabled={busy === m.id} onClick={() => remove(m.id)}>
              {busy === m.id ? "Deleting…" : "Delete"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
