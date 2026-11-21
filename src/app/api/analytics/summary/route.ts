import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex/server";
import { requireRole } from "@/lib/session";
import { serverError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    await requireRole("ops");

    const convex = getConvexClient();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30", 10);
    const nowIso = new Date().toISOString();
    const since = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();

    const summary = await convex.query(api.reports.getAnalyticsSummary, {
      since,
      nowIso,
    });

    return NextResponse.json(summary);
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("GET /api/analytics/summary:", err);
    return serverError();
  }
}
