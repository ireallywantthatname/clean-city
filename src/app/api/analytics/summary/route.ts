/**
 * GET /api/analytics/summary — KPI summary for ops dashboard
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase/server";
import { requireRole } from "@/lib/session";
import { serverError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    await requireRole("ops");

    const supabase = await getSupabaseRoute();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Open count (active statuses)
    const { count: openCount } = await supabase
      .from("reports")
      .select("*", { count: "exact", head: true })
      .in("status", ["NEW", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "BLOCKED"]);

    // Overdue count
    const { count: overdueCount } = await supabase
      .from("reports")
      .select("*", { count: "exact", head: true })
      .lt("sla_due_at", new Date().toISOString())
      .in("status", ["NEW", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "BLOCKED"]);

    // Median close hours (for reports created in window)
    const { data: doneReports } = await supabase
      .from("reports")
      .select("created_at, resolved_at")
      .eq("status", "DONE")
      .gte("created_at", since)
      .not("resolved_at", "is", null);

    let medianCloseHours: number | null = null;
    if (doneReports && doneReports.length > 0) {
      const hours = doneReports
        .map((r) => (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()) / 3_600_000)
        .sort((a, b) => a - b);
      const mid = Math.floor(hours.length / 2);
      medianCloseHours = hours.length % 2 === 0
        ? (hours[mid - 1] + hours[mid]) / 2
        : hours[mid];
    }

    // Top category
    const { data: typeCounts } = await supabase
      .from("reports")
      .select("type")
      .gte("created_at", since);

    const counts: Record<string, number> = {};
    (typeCounts || []).forEach((r) => { counts[r.type] = (counts[r.type] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

    return NextResponse.json({
      openCount: openCount || 0,
      overdueCount: overdueCount || 0,
      medianCloseHours,
      topCategory: top ? top[0] : null,
      topCategoryCount: top ? top[1] : 0,
    });
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("GET /api/analytics/summary:", err);
    return serverError();
  }
}
