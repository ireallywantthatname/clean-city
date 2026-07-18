/**
 * POST /api/ai/process-report — internal endpoint for full AI pipeline
 */
import { NextRequest, NextResponse } from "next/server";
import { processReport } from "@/lib/ai/pipeline";
import { serverError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-internal-ai-secret");
  if (secret !== (process.env.INTERNAL_AI_SECRET || "")) {
    return NextResponse.json({ title: "Forbidden", status: 403 }, { status: 403 });
  }

  try {
    const { reportId } = await request.json();
    if (!reportId) return NextResponse.json({ title: "Bad Request", status: 400 }, { status: 400 });

    const result = await processReport(reportId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/ai/process-report:", err);
    return serverError();
  }
}
