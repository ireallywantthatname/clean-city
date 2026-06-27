/**
 * Activity logging helper.
 * Writes activity entries to the `activities` table.
 */
import { getSupabaseRoute } from "@/lib/supabase/server";
import type { ActivityType } from "@/lib/types";

export async function logActivity(
  reportId: string,
  type: ActivityType,
  message: string,
  userId: string,
  userName: string,
) {
  const supabase = await getSupabaseRoute();
  await supabase.from("activities").insert({
    report_id: reportId,
    type,
    message,
    created_by: userId,
    created_by_name: userName,
    created_at: new Date().toISOString(),
  });
}
