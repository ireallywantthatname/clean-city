import { cookies } from "next/headers";
import { api } from "../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex/server";
import type { SessionUser, UserRole } from "@/lib/types";

export const SESSION_COOKIE_NAME = "cleancity_session";

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const convex = getConvexClient();
    const user = await convex.query(api.auth.getSession, {
      token,
      now: Date.now(),
    });
    return user;
  } catch {
    return null;
  }
}

export async function requireAnyRole(
  ...roles: UserRole[]
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Response(
      JSON.stringify({
        title: "Unauthorized",
        status: 401,
        detail: "Authentication required",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/problem+json" },
      },
    );
  }
  if (!roles.includes(user.role)) {
    throw new Response(
      JSON.stringify({
        title: "Forbidden",
        status: 403,
        detail: `Requires role: ${roles.join(" or ")}`,
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/problem+json" },
      },
    );
  }
  return user;
}

export async function requireRole(role: UserRole): Promise<SessionUser> {
  return requireAnyRole(role);
}
