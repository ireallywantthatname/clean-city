/**
 * POST /api/reports/[id]/merge — merge a report into another
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase/server";
import { requireRole } from "@/lib/session";
import { mergeReportSchema } from "@/lib/schemas";
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
    const parsed = mergeReportSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.message);

    if (parsed.data.targetReportId === id) {
      return badRequest("Cannot merge a report into itself");
    }

    const supabase = await getSupabaseRoute();

    // Fetch source and target
    const { data: source } = await supabase.from("reports").select("id, status").eq("id", id).single();
    if (!source) return notFound("Source report not found");

    const { data: target } = await supabase.from("reports").select("id").eq("id", parsed.data.targetReportId).single();
    if (!target) return notFound("Target report not found");

    // Merge: set source as REJECTED + linked to target
    const { error: updateErr } = await supabase
      .from("reports")
      .update({
        status: "REJECTED",
        merged_into_report_id: parsed.data.targetReportId,
      })
      .eq("id", id);
    if (updateErr) return serverError(updateErr.message);

    await logActivity(id, "MERGED", `Merged into report ${parsed.data.targetReportId}`, user.id, user.name);
    await logActivity(parsed.data.targetReportId, "MERGED", `Merged report ${id} into this`, user.id, user.name);

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("POST /api/reports/[id]/merge:", err);
    return serverError();
  }
}
