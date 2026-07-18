"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { resolvePostLoginPath } from "@/lib/callback-url";
import { LogIn } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = getSupabaseBrowser();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // Fetch role and redirect (prefer safe callbackUrl when present)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .single();

    setLoading(false);
    const dest = resolvePostLoginPath(
      searchParams.get("callbackUrl"),
      profile?.role,
    );
    router.push(dest);
    router.refresh();
  }

  function fillDemo(role: "ops" | "crew") {
    if (role === "ops") {
      setEmail("ops@cleancity.dev");
      setPassword("password123");
    } else {
      setEmail("crew1@cleancity.dev");
      setPassword("password123");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm p-8 border border-border">
        <div className="mb-8">
          <h1 className="text-xl font-bold font-sans tracking-tight">
            CleanCity
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            Staff access
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-mono text-muted-foreground mb-1.5 uppercase tracking-wider"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-foreground transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-mono text-muted-foreground mb-1.5 uppercase tracking-wider"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-background border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:border-foreground transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-xs font-mono text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-foreground text-background px-3 py-2 text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                Signing in…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <LogIn className="h-4 w-4" />
                Sign in
              </span>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-xs font-mono text-muted-foreground mb-3 uppercase tracking-wider">
            Demo accounts
          </p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => fillDemo("ops")}
              className="w-full text-left border border-border px-3 py-2 text-sm hover:bg-secondary transition-colors"
            >
              <span className="font-bold">Operations</span>
              <span className="text-muted-foreground ml-2 font-mono text-xs">
                ops@cleancity.dev
              </span>
            </button>
            <button
              type="button"
              onClick={() => fillDemo("crew")}
              className="w-full text-left border border-border px-3 py-2 text-sm hover:bg-secondary transition-colors"
            >
              <span className="font-bold">Crew</span>
              <span className="text-muted-foreground ml-2 font-mono text-xs">
                crew1@cleancity.dev
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-sm font-mono text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
