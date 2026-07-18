/**
 * Supabase server client — for App Router server components and route handlers.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: Record<string, unknown> };

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase environment variables");
  return { url, anonKey };
}

export async function getSupabase() {
  const { url, anonKey } = getEnv();
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet: CookieToSet[]) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

/**
 * Elevated/server client for route handlers.
 * Prefers SUPABASE_SERVICE_ROLE_KEY (bypasses RLS). Falls back to the anon key
 * so local dev works before the service role key is configured — relies on
 * RLS policies allowing the necessary reads/writes.
 */
export async function getSupabaseRoute() {
  const { url, anonKey } = getEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const key =
    serviceRoleKey && !serviceRoleKey.includes("NeedToGetThis")
      ? serviceRoleKey
      : anonKey;
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet: CookieToSet[]) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}
