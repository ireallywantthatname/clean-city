import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { badRequest, serverError, unauthorized } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      email?: unknown;
      password?: unknown;
    } | null;

    if (
      !body ||
      typeof body.email !== "string" ||
      typeof body.password !== "string"
    ) {
      return badRequest("Email and password are required");
    }

    const convex = getConvexClient();
    const result = await convex.mutation(api.auth.signIn, {
      email: body.email,
      password: body.password,
    });

    if (!result) {
      return unauthorized("Invalid login credentials");
    }

    const response = NextResponse.json({ user: result.user });
    response.cookies.set(SESSION_COOKIE_NAME, result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    return response;
  } catch (err) {
    console.error("POST /api/auth/login:", err);
    return serverError();
  }
}
