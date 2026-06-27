/**
 * GET /api/reports/[id]/activities — list activities for a report
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/session";
import { serverError } from "@/lib/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ title: "Unauthorized", status: 401 }, { status: 401 });

    const supabase = await getSupabaseRoute();
    const { data: activities, error } = await supabase
      .from("activities")
      .select("*")
      .eq("report_id", id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return serverError(error.message);

    return NextResponse.json(activities || []);
  } catch (err) {
    console.error("GET /api/reports/[id]/activities:", err);
    return serverError();
  }
}
