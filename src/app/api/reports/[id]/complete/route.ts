import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { getConvexClient } from "@/lib/convex/server";
import { uploadFileToConvex } from "@/lib/convex/storage";
import { requireAnyRole } from "@/lib/session";
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

    const convex = getConvexClient();
    const report = await convex.query(api.reports.getById, { id });
    if (!report) return notFound("Report not found");

    if (user.role === "crew" && report.assignedToUserId !== user.id) {
      return NextResponse.json(
        { title: "Forbidden", status: 403 },
        { status: 403 },
      );
    }

    let afterPhotoStorageId: Id<"_storage"> | undefined;
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const uploaded = await uploadFileToConvex(buffer, file.type);
      afterPhotoStorageId = uploaded.storageId;
    }

    const updated = await convex.mutation(api.reports.update, {
      id,
      status: "DONE",
      completionNotes,
      resolvedAt: new Date().toISOString(),
      afterPhotoStorageId,
    });
    if (!updated) return serverError("Failed to complete report");

    await logActivity(
      id,
      "COMPLETED",
      `Job completed${completionNotes ? ": " + completionNotes : ""}`,
      user.id,
      user.name,
    );

    const aiSecret = process.env.INTERNAL_AI_SECRET || "";
    fetch(`${request.nextUrl.origin}/api/ai/process-completion`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-ai-secret": aiSecret,
      },
      body: JSON.stringify({ reportId: id }),
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("POST /api/reports/[id]/complete:", err);
    return serverError();
  }
}
