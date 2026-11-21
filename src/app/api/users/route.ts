import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex/server";
import { requireRole } from "@/lib/session";
import { serverError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    await requireRole("ops");

    const convex = getConvexClient();
    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get("role");
    const role: "ops" | "crew" = roleParam === "ops" ? "ops" : "crew";

    const users = await convex.query(api.users.listByRole, { role });

    return NextResponse.json(users);
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("GET /api/users:", err);
    return serverError();
  }
}
