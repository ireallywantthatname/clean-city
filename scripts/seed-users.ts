/**
 * Seed demo users via Supabase Admin API.
 *
 * Usage: bun run scripts/seed-users.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface DemoUser {
  email: string;
  password: string;
  name: string;
  role: "ops" | "crew";
}

const DEMO_USERS: DemoUser[] = [
  { email: "ops@cleancity.dev", password: "password123", name: "Ops Admin", role: "ops" },
  { email: "crew1@cleancity.dev", password: "password123", name: "Crew One", role: "crew" },
  { email: "crew2@cleancity.dev", password: "password123", name: "Crew Two", role: "crew" },
];

async function seed() {
  console.log("Seeding demo users…\n");

  for (const user of DEMO_USERS) {
    // Check if user already exists
    const { data: existing } = await supabase.auth.admin.listUsers();
    const alreadyExists = existing?.users?.some((u) => u.email === user.email);

    if (alreadyExists) {
      console.log(`  SKIP: ${user.email} (already exists)`);
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { name: user.name, role: user.role },
    });

    if (error) {
      console.error(`  ERROR creating ${user.email}:`, error.message);
    } else {
      console.log(`  CREATED: ${user.email} (${user.role}) — id: ${data.user?.id}`);
    }
  }

  console.log("\nDone.");
}

seed().catch(console.error);
