import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex/server";
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

    const convex = getConvexClient();

    const source = await convex.query(api.reports.getById, { id });
    if (!source) return notFound("Source report not found");

    const target = await convex.query(api.reports.getById, {
      id: parsed.data.targetReportId,
    });
    if (!target) return notFound("Target report not found");

    const updated = await convex.mutation(api.reports.update, {
      id,
      status: "REJECTED",
      mergedIntoReportId: parsed.data.targetReportId,
    });
    if (!updated) return serverError("Failed to merge report");

    await logActivity(
      id,
      "MERGED",
      `Merged into report ${parsed.data.targetReportId}`,
      user.id,
      user.name,
    );
    await logActivity(
      parsed.data.targetReportId,
      "MERGED",
      `Merged report ${id} into this`,
      user.id,
      user.name,
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("POST /api/reports/[id]/merge:", err);
    return serverError();
  }
}
