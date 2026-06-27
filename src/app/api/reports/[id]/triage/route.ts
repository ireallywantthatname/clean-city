/**
 * POST /api/reports/[id]/triage — set priority and triage a report
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase/server";
import { requireRole } from "@/lib/session";
import { triageSchema, computeSlaDueAt } from "@/lib/schemas";
import { logActivity } from "@/lib/activities";
import { badRequest, notFound, serverError } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await requireRole("ops");

    const body = await request.json();
    const parsed = triageSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.message);

    const supabase = await getSupabaseRoute();

    const { data: report, error: fetchErr } = await supabase
      .from("reports")
      .select("status")
      .eq("id", id)
      .single();
    if (fetchErr || !report) return notFound("Report not found");

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      priority: parsed.data.priority,
      sla_due_at: computeSlaDueAt(parsed.data.priority).toISOString(),
    };

    if (report.status === "NEW") {
      updates.status = "TRIAGED";
      updates.triaged_at = now;
      updates.triaged_by_user_id = user.id;
    }

    const { error: updateErr } = await supabase
      .from("reports")
      .update(updates)
      .eq("id", id);
    if (updateErr) return serverError(updateErr.message);

    await logActivity(
      id, "TRIAGED",
      `Triaged as ${parsed.data.priority}${body.notes ? ": " + body.notes : ""}`,
      user.id, user.name,
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("POST /api/reports/[id]/triage:", err);
    return serverError();
  }
}
