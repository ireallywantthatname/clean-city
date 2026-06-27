/**
 * PATCH /api/reports/[id]/status — change report status
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase/server";
import { requireAnyRole } from "@/lib/session";
import { statusChangeSchema, isValidTransition, canRoleSetStatus } from "@/lib/schemas";
import { logActivity } from "@/lib/activities";
import { badRequest, notFound, serverError } from "@/lib/errors";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await requireAnyRole("ops", "crew");

    const body = await request.json();
    const parsed = statusChangeSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.message);

    const supabase = await getSupabaseRoute();

    const { data: report, error: fetchErr } = await supabase
      .from("reports")
      .select("status, assigned_to_user_id")
      .eq("id", id)
      .single();
    if (fetchErr || !report) return notFound("Report not found");

    // Validate transition
    if (!isValidTransition(report.status, parsed.data.status)) {
      return badRequest(`Cannot transition from ${report.status} to ${parsed.data.status}`);
    }

    // Role check
    if (!canRoleSetStatus(user.role, parsed.data.status)) {
      return NextResponse.json(
        { title: "Forbidden", status: 403, detail: `${user.role} cannot set status to ${parsed.data.status}` },
        { status: 403 },
      );
    }

    // Crew can only update their own reports
    if (user.role === "crew" && report.assigned_to_user_id !== user.id) {
      return NextResponse.json({ title: "Forbidden", status: 403 }, { status: 403 });
    }

    const { error: updateErr } = await supabase
      .from("reports")
      .update({ status: parsed.data.status })
      .eq("id", id);
    if (updateErr) return serverError(updateErr.message);

    const note = body.notes ? `: ${body.notes}` : "";
    await logActivity(id, "STATUS_CHANGE", `${report.status} → ${parsed.data.status}${note}`, user.id, user.name);

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("PATCH /api/reports/[id]/status:", err);
    return serverError();
  }
}
