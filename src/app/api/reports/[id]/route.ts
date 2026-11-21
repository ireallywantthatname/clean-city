import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex/server";
import { getSessionUser } from "@/lib/session";
import { notFound, serverError } from "@/lib/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { title: "Unauthorized", status: 401 },
        { status: 401 },
      );
    }

    const convex = getConvexClient();
    const report = await convex.query(api.reports.getById, {
      id,
      includeActivities: true,
    });

    if (!report) return notFound("Report not found");

    return NextResponse.json(report);
  } catch (err) {
    console.error("GET /api/reports/[id]:", err);
    return serverError();
  }
}
