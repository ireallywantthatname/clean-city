import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex/server";
import { requireRole } from "@/lib/session";
import { haversineDistance } from "@/lib/geo";
import { notFound, serverError } from "@/lib/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await requireRole("ops");

    const convex = getConvexClient();
    const report = await convex.query(api.reports.getById, { id });
    if (!report) return notFound("Report not found");

    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const candidates = await convex.query(api.reports.listRecentSince, {
      since: cutoff,
      type: report.type,
      limit: 100,
    });

    const duplicates = candidates
      .filter((c) => c.id !== id)
      .filter((c) => c.status !== "REJECTED")
      .filter((c) => haversineDistance(report.lat, report.lng, c.lat, c.lng) <= 100)
      .map((c) => ({
        id: c.id,
        type: c.type,
        lat: c.lat,
        lng: c.lng,
        notes: c.notes ?? null,
        created_at: c.createdAt,
        createdAt: c.createdAt,
        status: c.status,
        distance_meters: Math.round(
          haversineDistance(report.lat, report.lng, c.lat, c.lng),
        ),
      }))
      .sort((a, b) => (a.distance_meters || 0) - (b.distance_meters || 0))
      .slice(0, 10);

    return NextResponse.json({ duplicates });
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("GET /api/reports/[id]/duplicates:", err);
    return serverError();
  }
}
