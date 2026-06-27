/**
 * GET /api/reports/[id] — get a single report with activities
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/session";
import { notFound, serverError } from "@/lib/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ title: "Unauthorized", status: 401 }, { status: 401 });

    const supabase = await getSupabaseRoute();
    const { data: report, error } = await supabase
      .from("reports")
      .select("*, activities(*)")
      .eq("id", id)
      .single();

    if (error || !report) return notFound("Report not found");

    return NextResponse.json(report);
  } catch (err) {
    console.error("GET /api/reports/[id]:", err);
    return serverError();
  }
}
