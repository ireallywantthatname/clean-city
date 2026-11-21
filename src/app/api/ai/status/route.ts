import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex/server";
import { badRequest, notFound, serverError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get("reportId");
    if (!reportId) return badRequest("reportId query parameter is required");

    const convex = getConvexClient();
    const report = await convex.query(api.reports.getById, { id: reportId });

    if (!report) return notFound("Report not found");

    const ai = report.ai;
    return NextResponse.json({
      status: ai?.status || "PENDING",
      garbageDetector: ai?.garbageDetector || null,
      visionTriage: ai?.visionTriage || null,
      crewBrief: ai?.crewBrief || null,
      duplicates: ai?.duplicates || null,
      errors: ai?.errors || [],
    });
  } catch (err) {
    console.error("GET /api/ai/status:", err);
    return serverError();
  }
}
