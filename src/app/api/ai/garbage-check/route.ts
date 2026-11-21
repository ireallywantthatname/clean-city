import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex/server";
import { requireRole } from "@/lib/session";
import { processReport } from "@/lib/ai/pipeline";
import { badRequest, notFound, serverError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    await requireRole("ops");

    const { reportId, force } = await request.json();
    if (!reportId) return badRequest("reportId is required");

    if (force) {
      const convex = getConvexClient();
      const report = await convex.query(api.reports.getById, { id: reportId });
      if (!report) return notFound("Report not found");
      if (report.ai?.garbageDetector) {
        await convex.mutation(api.reports.update, {
          id: reportId,
          ai: { ...report.ai, garbageDetector: null, status: "PENDING" },
        });
      }
    }

    const result = await processReport(reportId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("POST /api/ai/garbage-check:", err);
    return serverError();
  }
}
