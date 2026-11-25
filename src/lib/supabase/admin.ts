import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, serviceRoleKey } from "@/lib/env";

/** Full-access client. Server only: used by the iPhone sync endpoint, the cron job and the food cache. */
export function createAdminClient() {
  return createClient(SUPABASE_URL, serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
