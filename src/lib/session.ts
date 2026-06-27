/**
 * Session helpers — server-side only.
 *
 * Verifies Supabase Auth session + resolves user profile (role) in one shot.
 */
import { getSupabase } from "@/lib/supabase/server";
import type { SessionUser, UserRole } from "@/lib/types";

/**
 * Get the currently authenticated user with role from profiles table.
 * Returns null if not authenticated.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await getSupabase();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.email) return null;

  // Fetch role from profiles table
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email,
    name: profile?.name || user.email,
    role: (profile?.role as UserRole) || "crew",
  };
}

/**
 * Require any role from the list. Throws 401/403 Response if not authorized.
 */
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

/**
 * Require a specific role.
 */
export async function requireRole(role: UserRole): Promise<SessionUser> {
  return requireAnyRole(role);
}
