/**
 * GET /api/analytics/hotspots — geohash-prefix grid aggregation for hotspot overlay
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase/server";
import { requireRole } from "@/lib/session";
import { decodeGeohash } from "@/lib/geo";
import { serverError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    await requireRole("ops");

    const supabase = await getSupabaseRoute();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all report positions in window
    const { data: reports, error } = await supabase
      .from("reports")
      .select("geohash")
      .gte("created_at", since)
      .not("geohash", "is", null);

    if (error) return serverError(error.message);

    // Aggregate by geohash prefix (6 chars ~= 1.2km x 0.6km cells)
    const grid: Record<string, number> = {};
    (reports || []).forEach((r) => {
      if (!r.geohash) return;
      const cell = r.geohash.slice(0, 6);
      grid[cell] = (grid[cell] || 0) + 1;
    });

    // Convert to array, filter to cells with ≥2 reports
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
