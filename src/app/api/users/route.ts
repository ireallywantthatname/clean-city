/**
 * GET /api/users — list crew users for assignment dropdown
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
    const role = searchParams.get("role") || "crew";

    const { data: users, error } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("role", role)
      .order("name");

    if (error) return serverError(error.message);

    return NextResponse.json(users || []);
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("GET /api/users:", err);
    return serverError();
  }
}
