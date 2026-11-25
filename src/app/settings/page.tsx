import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireUser } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const auth = await requireUser();
  if (!auth) redirect("/login");
  const { data } = await auth.supabase.from("profiles").select("*").eq("user_id", auth.user.id).maybeSingle();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <SettingsForm profile={data} email={auth.user.email ?? ""} syncUrl={`${origin}/api/health/sync`} />
    </div>
  );
}
