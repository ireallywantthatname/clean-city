import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex/server";
import { requireAnyRole } from "@/lib/session";
import {
  statusChangeSchema,
  isValidTransition,
  canRoleSetStatus,
} from "@/lib/schemas";
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

    const convex = getConvexClient();
    const report = await convex.query(api.reports.getById, { id });
    if (!report) return notFound("Report not found");

    if (!isValidTransition(report.status, parsed.data.status)) {
      return badRequest(
        `Cannot transition from ${report.status} to ${parsed.data.status}`,
      );
    }

    if (!canRoleSetStatus(user.role, parsed.data.status)) {
      return NextResponse.json(
        {
          title: "Forbidden",
          status: 403,
          detail: `${user.role} cannot set status to ${parsed.data.status}`,
        },
        { status: 403 },
      );
    }

    if (user.role === "crew" && report.assignedToUserId !== user.id) {
      return NextResponse.json(
        { title: "Forbidden", status: 403 },
        { status: 403 },
      );
    }

    const updated = await convex.mutation(api.reports.update, {
      id,
      status: parsed.data.status,
    });
    if (!updated) return serverError("Failed to update report status");

    const note = body.notes ? `: ${body.notes}` : "";
    await logActivity(
      id,
      "STATUS_CHANGE",
      `${report.status} -> ${parsed.data.status}${note}`,
      user.id,
      user.name,
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("PATCH /api/reports/[id]/status:", err);
    return serverError();
  }
}
