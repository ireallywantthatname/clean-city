/**
 * GET /api/reports/[id]/duplicates — find duplicate reports (same type, within 100m, 72h)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase/server";
import { requireRole } from "@/lib/session";
import { haversineDistance } from "@/lib/geo";
import { notFound, serverError } from "@/lib/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await requireRole("ops");

    const supabase = await getSupabaseRoute();

    const { data: report, error: fetchErr } = await supabase
      .from("reports")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr || !report) return notFound("Report not found");

    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const { data: candidates } = await supabase
      .from("reports")
      .select("id, type, lat, lng, notes, created_at, status")
      .eq("type", report.type)
      .gte("created_at", cutoff)
      .neq("id", id)
      .limit(100);

    const duplicates = (candidates || [])
      .filter((c) => c.status !== "REJECTED")
      .filter((c) => {
        return haversineDistance(
          report.lat, report.lng,
          c.lat, c.lng,
        ) <= 100;
      })
      .map((c) => ({
        ...c,
        distance_meters: Math.round(haversineDistance(report.lat, report.lng, c.lat, c.lng)),
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
