import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    try {
      const convex = getConvexClient();
      await convex.mutation(api.auth.signOut, { token });
    } catch {
      void 0;
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
