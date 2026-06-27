/**
 * GET /api/reports/export — CSV export
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

    let query = supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5000);

    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const priority = searchParams.get("priority");

    if (status && status !== "all") query = query.eq("status", status.toUpperCase());
    if (type && type !== "all") query = query.eq("type", type.toUpperCase());
    if (priority && priority !== "all") query = query.eq("priority", priority.toUpperCase());

    const { data: reports, error } = await query;
    if (error) return serverError(error.message);

    const headers = ["ID", "Type", "Status", "Priority", "Lat", "Lng", "Notes", "Assigned To", "Created At", "Resolved At", "SLA Due"];
    const rows = (reports || []).map((r) => [
      r.id, r.type, r.status, r.priority || "",
      r.lat, r.lng, `"${(r.notes || "").replace(/"/g, '""')}"`,
      r.assigned_to_name || "", r.created_at, r.resolved_at || "", r.sla_due_at || "",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="reports-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("GET /api/reports/export:", err);
    return serverError();
  }
}
