/**
 * POST /api/reports/[id]/complete — complete a report (upload after photo)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase/server";
import { requireAnyRole } from "@/lib/session";
import { uploadFile } from "@/lib/supabase/storage";
import { completeReportSchema } from "@/lib/schemas";
import { logActivity } from "@/lib/activities";
import { badRequest, notFound, serverError } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await requireAnyRole("ops", "crew");

    const formData = await request.formData();
    const completionNotes = (formData.get("completionNotes") as string) || "";
    const file = formData.get("afterPhoto") as File | null;

    const parsed = completeReportSchema.safeParse({ completionNotes });
    if (!parsed.success) return badRequest(parsed.error.message);

    const supabase = await getSupabaseRoute();

    const { data: report, error: fetchErr } = await supabase
      .from("reports")
      .select("status, assigned_to_user_id")
      .eq("id", id)
      .single();
    if (fetchErr || !report) return notFound("Report not found");

    // Crew can only complete their own reports
    if (user.role === "crew" && report.assigned_to_user_id !== user.id) {
      return NextResponse.json({ title: "Forbidden", status: 403 }, { status: 403 });
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status: "DONE",
      completion_notes: completionNotes,
      resolved_at: now,
    };

    // Upload after photo if provided
    if (file) {
      const ext = file.name.split(".").pop() || "jpg";
      const storagePath = `reports/${id}/after.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const photoUrl = await uploadFile(storagePath, buffer, file.type);
      updates.after_photo_url = photoUrl;
    }

    const { error: updateErr } = await supabase
      .from("reports")
      .update(updates)
      .eq("id", id);
    if (updateErr) return serverError(updateErr.message);

    await logActivity(id, "COMPLETED", `Job completed${completionNotes ? ": " + completionNotes : ""}`, user.id, user.name);

    // Fire-and-forget AI completion pipeline
    const aiSecret = process.env.INTERNAL_AI_SECRET || "";
    fetch(`${request.nextUrl.origin}/api/ai/process-completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-ai-secret": aiSecret },
      body: JSON.stringify({ reportId: id }),
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("POST /api/reports/[id]/complete:", err);
    return serverError();
  }
}
