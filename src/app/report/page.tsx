import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { isIsoDate, localDate } from "@/lib/time";
import type { DailyReport } from "@/lib/report";
import { ReportView } from "@/components/ReportView";

export const dynamic = "force-dynamic";

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const auth = await requireUser();
  if (!auth) redirect("/login");
  const { date: q } = await searchParams;
  const date = isIsoDate(q) ? q : localDate();
  const { data } = await auth.supabase.from("daily_reports").select("report").eq("report_date", date).maybeSingle();
  return <ReportView date={date} initial={(data?.report as DailyReport | undefined) ?? null} />;
}
