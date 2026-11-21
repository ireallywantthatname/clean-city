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
    const status = searchParams.get("status") ?? undefined;
    const type = searchParams.get("type") ?? undefined;
    const priority = searchParams.get("priority") ?? undefined;

    const { reports } = await convex.query(api.reports.list, {
      status,
      type,
      priority,
      limit: 5000,
    });

    const headers = [
      "ID",
      "Type",
      "Status",
      "Priority",
      "Lat",
      "Lng",
      "Notes",
      "Assigned To",
      "Created At",
      "Resolved At",
      "SLA Due",
    ];
    const rows = reports.map((r) => [
      r.id,
      r.type,
      r.status,
      r.priority || "",
      r.lat,
      r.lng,
      `"${(r.notes || "").replace(/"/g, '""')}"`,
      r.assignedToName || "",
      r.createdAt,
      r.resolvedAt || "",
      r.slaDueAt || "",
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
