/**
 * POST /api/ai/retry-pending — retry failed/pending AI for one or all reports
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase/server";
import { requireRole } from "@/lib/session";
import { processReport } from "@/lib/ai/pipeline";
import { badRequest, serverError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    await requireRole("ops");

    const body = await request.json().catch(() => ({}));
    const reportId = body.reportId as string | undefined;

    const supabase = await getSupabaseRoute();

    if (reportId) {
      // Retry single report
      const { data: report } = await supabase
        .from("reports")
        .select("ai")
        .eq("id", reportId)
        .single();
      if (!report) return badRequest("Report not found");

      const ai = report.ai || {};
      const status = ai.status || "COMPLETE";
      if (status === "COMPLETE") {
        return NextResponse.json({ message: "AI already complete for this report", skipped: true });
      }

      // Fire-and-forget
      const aiSecret = process.env.INTERNAL_AI_SECRET || "";
      fetch(`${request.nextUrl.origin}/api/ai/process-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-ai-secret": aiSecret },
        body: JSON.stringify({ reportId }),
      }).catch(() => {});

      return NextResponse.json({ message: "Retry triggered", count: 1 });
    }

    // Retry all pending/failed
    const { data: pending } = await supabase
      .from("reports")
      .select("id")
      .or("ai->>status.eq.PENDING,ai->>status.eq.FAILED")
      .limit(50);

    if (!pending?.length) {
      return NextResponse.json({ message: "No pending reports", count: 0 });
    }

    const aiSecret = process.env.INTERNAL_AI_SECRET || "";
    for (const r of pending) {
      fetch(`${request.nextUrl.origin}/api/ai/process-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-ai-secret": aiSecret },
        body: JSON.stringify({ reportId: r.id }),
      }).catch(() => {});
    }

    return NextResponse.json({ message: "Retries triggered", count: pending.length });
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("POST /api/ai/retry-pending:", err);
    return serverError();
  }
}
