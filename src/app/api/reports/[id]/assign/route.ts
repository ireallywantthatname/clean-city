/**
 * PATCH /api/reports/[id]/assign — assign report to crew member
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase/server";
import { requireRole } from "@/lib/session";
import { assignReportSchema, computeSlaDueAt } from "@/lib/schemas";
import { logActivity } from "@/lib/activities";
import { badRequest, notFound, serverError } from "@/lib/errors";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await requireRole("ops");

    const body = await request.json();
    const parsed = assignReportSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.message);

    const supabase = await getSupabaseRoute();

    // Fetch current report
    const { data: report, error: fetchErr } = await supabase
      .from("reports")
      .select("status, priority")
      .eq("id", id)
      .single();
    if (fetchErr || !report) return notFound("Report not found");

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      assigned_to_user_id: parsed.data.assignedToUserId,
      assigned_to_name: parsed.data.assignedToName,
      assigned_at: now,
    };

    // Auto-transition from NEW to TRIAGED → ASSIGNED
    if (report.status === "NEW") {
      updates.status = "ASSIGNED";
      updates.triaged_at = now;
      updates.triaged_by_user_id = user.id;
      updates.sla_due_at = computeSlaDueAt((report.priority as string) || "MEDIUM").toISOString();
      await logActivity(id, "TRIAGED", "Auto-triaged on assignment", user.id, user.name);
    } else if (report.status === "TRIAGED") {
      updates.status = "ASSIGNED";
    }

    const { error: updateErr } = await supabase
      .from("reports")
      .update(updates)
      .eq("id", id);
    if (updateErr) return serverError(updateErr.message);

    await logActivity(
      id, "ASSIGNED",
      `Assigned to ${parsed.data.assignedToName || parsed.data.assignedToUserId}`,
      user.id, user.name,
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("PATCH /api/reports/[id]/assign:", err);
    return serverError();
  }
}
