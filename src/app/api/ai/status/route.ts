/**
 * GET /api/ai/status — poll AI processing status for a report
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase/server";
import { badRequest, notFound, serverError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get("reportId");
    if (!reportId) return badRequest("reportId query parameter is required");

    const supabase = await getSupabaseRoute();
    const { data: report } = await supabase
      .from("reports")
      .select("ai")
      .eq("id", reportId)
      .single();

    if (!report) return notFound("Report not found");

    const ai = report.ai || {};
    return NextResponse.json({
      status: ai.status || "PENDING",
      garbageDetector: ai.garbageDetector || null,
      visionTriage: ai.visionTriage || null,
      crewBrief: ai.crewBrief || null,
      duplicates: ai.duplicates || null,
      errors: ai.errors || [],
    });
  } catch (err) {
    console.error("GET /api/ai/status:", err);
    return serverError();
  }
}
