import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex/server";
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

    const convex = getConvexClient();
    const report = await convex.query(api.reports.getById, { id });
    if (!report) return notFound("Report not found");

    const now = new Date().toISOString();
    const updated = await convex.mutation(api.reports.update, {
      id,
      priority: parsed.data.priority,
      slaDueAt: computeSlaDueAt(parsed.data.priority).toISOString(),
      status: report.status === "NEW" ? "TRIAGED" : undefined,
      triagedAt: report.status === "NEW" ? now : undefined,
      triagedByUserId: report.status === "NEW" ? user.id : undefined,
    });
    if (!updated) return serverError("Failed to triage report");

    await logActivity(
      id,
      "TRIAGED",
      `Triaged as ${parsed.data.priority}${body.notes ? ": " + body.notes : ""}`,
      user.id,
      user.name,
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("POST /api/reports/[id]/triage:", err);
    return serverError();
  }
}
