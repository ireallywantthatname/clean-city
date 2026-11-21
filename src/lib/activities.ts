import { api } from "../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex/server";
import type { ActivityType } from "@/lib/types";

export async function logActivity(
  reportId: string,
  type: ActivityType,
  message: string,
  userId: string,
  userName: string,
) {
  const convex = getConvexClient();
  await convex.mutation(api.activities.log, {
    reportId,
    type,
    message,
    createdBy: userId,
    createdByName: userName,
    createdAt: new Date().toISOString(),
  });
}
