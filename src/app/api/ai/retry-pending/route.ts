import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex/server";
import { requireRole } from "@/lib/session";
import { badRequest, serverError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    await requireRole("ops");

    const body = await request.json().catch(() => ({}));
    const reportId = body.reportId as string | undefined;

    const convex = getConvexClient();

    if (reportId) {
      const report = await convex.query(api.reports.getById, { id: reportId });
      if (!report) return badRequest("Report not found");

      const status = report.ai?.status || "COMPLETE";
      if (status === "COMPLETE") {
        return NextResponse.json({
          message: "AI already complete for this report",
          skipped: true,
        });
      }

      const aiSecret = process.env.INTERNAL_AI_SECRET || "";
      fetch(`${request.nextUrl.origin}/api/ai/process-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-ai-secret": aiSecret,
        },
        body: JSON.stringify({ reportId }),
      }).catch(() => {});

      return NextResponse.json({ message: "Retry triggered", count: 1 });
    }

    const pending = await convex.query(api.reports.listPendingAi, {
      limit: 50,
    });

    if (!pending.length) {
      return NextResponse.json({ message: "No pending reports", count: 0 });
    }

    const aiSecret = process.env.INTERNAL_AI_SECRET || "";
    for (const r of pending) {
      fetch(`${request.nextUrl.origin}/api/ai/process-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-ai-secret": aiSecret,
        },
        body: JSON.stringify({ reportId: r.id }),
      }).catch(() => {});
    }

    return NextResponse.json({
      message: "Retries triggered",
      count: pending.length,
    });
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("POST /api/ai/retry-pending:", err);
    return serverError();
  }
}
