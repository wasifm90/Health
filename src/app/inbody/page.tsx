import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { InBodyUploader } from "@/components/InBodyUploader";
import { InBodyHistory } from "@/components/InBodyHistory";

export const dynamic = "force-dynamic";

export default async function InBodyPage() {
  const auth = await requireUser();
  if (!auth) redirect("/login");
  const { data } = await auth.supabase.from("inbody_scans").select("id, scan_date, data").order("scan_date", { ascending: false }).limit(20);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">InBody</h1>
      <InBodyUploader />
      <InBodyHistory scans={(data ?? []) as { id: string; scan_date: string; data: Record<string, number | string | null> }[]} />
    </div>
  );
}
