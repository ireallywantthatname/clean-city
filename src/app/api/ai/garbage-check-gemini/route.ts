/**
 * POST /api/ai/garbage-check-gemini — manually trigger garbage detection
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { processReport } from "@/lib/ai/pipeline";
import { getSupabaseRoute } from "@/lib/supabase/server";
import { badRequest, notFound, serverError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    await requireRole("ops");

    const { reportId, force } = await request.json();
    if (!reportId) return badRequest("reportId is required");

    if (force) {
      // Clear AI cache for this report
      const supabase = await getSupabaseRoute();
      const { data: report } = await supabase.from("reports").select("ai").eq("id", reportId).single();
      if (!report) return notFound("Report not found");
      if (report.ai?.garbageDetector) {
        await supabase.from("reports").update({
          ai: { ...report.ai, garbageDetector: null, status: "PENDING" },
        }).eq("id", reportId);
      }
    }

    const result = await processReport(reportId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("POST /api/ai/garbage-check-gemini:", err);
    return serverError();
  }
}
