import { FoodLogger } from "@/components/FoodLogger";

export default function LogPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Log food</h1>
      <FoodLogger />
    </div>
  );
}
