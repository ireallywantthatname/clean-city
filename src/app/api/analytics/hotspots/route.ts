import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex/server";
import { requireRole } from "@/lib/session";
import { decodeGeohash } from "@/lib/geo";
import { serverError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    await requireRole("ops");

    const convex = getConvexClient();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30", 10);
    const since = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();

    const geohashes = await convex.query(api.reports.getGeohashesSince, {
      since,
    });

    const grid: Record<string, number> = {};
    for (const hash of geohashes) {
      if (!hash) continue;
      const cell = hash.slice(0, 6);
      grid[cell] = (grid[cell] || 0) + 1;
    }

    const hotspots = Object.entries(grid)
      .filter(([, count]) => count >= 2)
      .map(([cellId, count]) => {
        const { lat, lng } = decodeGeohash(cellId);
        return { cellId, centerLat: lat, centerLng: lng, count };
      })
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({ hotspots });
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("GET /api/analytics/hotspots:", err);
    return serverError();
  }
}
