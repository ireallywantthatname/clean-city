/**
 * Seed one staff account per app role via Supabase Admin API.
 *
 * Usage: bun run scripts/seed-users.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 * Credentials live in src/lib/seed-accounts.ts — never surface them in the UI.
 */
import { createClient } from "@supabase/supabase-js";
import {
  ALL_USER_ROLES,
  SEED_ACCOUNTS,
  rolesMissingSeedAccounts,
} from "../src/lib/seed-accounts";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const missing = rolesMissingSeedAccounts();
if (missing.length > 0) {
  console.error(
    `Seed list is incomplete — missing roles: ${missing.join(", ")}. ` +
      `Expected coverage for: ${ALL_USER_ROLES.join(", ")}`,
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seed() {
  console.log("Seeding staff accounts (one per role)…\n");

  for (const user of SEED_ACCOUNTS) {
    const { data: existing } = await supabase.auth.admin.listUsers();
    const alreadyExists = existing?.users?.some((u) => u.email === user.email);

    if (alreadyExists) {
      console.log(`  SKIP: ${user.email} (${user.role}) — already exists`);
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

  console.log("\nDone. Accounts are not shown in the login UI.");
}

seed().catch(console.error);
