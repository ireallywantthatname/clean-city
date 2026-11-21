import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex/server";
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

    const convex = getConvexClient();
    const report = await convex.query(api.reports.getById, { id });
    if (!report) return notFound("Report not found");

    const now = new Date().toISOString();
    const updates: {
      id: string;
      assignedToUserId: string;
      assignedToName: string;
      assignedAt: string;
      status?: "ASSIGNED";
      triagedAt?: string;
      triagedByUserId?: string;
      slaDueAt?: string;
    } = {
      id,
      assignedToUserId: parsed.data.assignedToUserId,
      assignedToName: parsed.data.assignedToName,
      assignedAt: now,
    };

    if (report.status === "NEW") {
      updates.status = "ASSIGNED";
      updates.triagedAt = now;
      updates.triagedByUserId = user.id;
      updates.slaDueAt = computeSlaDueAt(
        report.priority || "MEDIUM",
      ).toISOString();
      await logActivity(
        id,
        "TRIAGED",
        "Auto-triaged on assignment",
        user.id,
        user.name,
      );
    } else if (report.status === "TRIAGED") {
      updates.status = "ASSIGNED";
    }

    const updated = await convex.mutation(api.reports.update, updates);
    if (!updated) return serverError("Failed to update report");

    await logActivity(
      id,
      "ASSIGNED",
      `Assigned to ${parsed.data.assignedToName || parsed.data.assignedToUserId}`,
      user.id,
      user.name,
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("PATCH /api/reports/[id]/assign:", err);
    return serverError();
  }
}
