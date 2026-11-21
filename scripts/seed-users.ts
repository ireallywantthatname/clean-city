import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import {
  ALL_USER_ROLES,
  SEED_ACCOUNTS,
  rolesMissingSeedAccounts,
} from "../src/lib/seed-accounts";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  console.error("Missing NEXT_PUBLIC_CONVEX_URL");
  process.exit(1);
}

const missing = rolesMissingSeedAccounts();
if (missing.length > 0) {
  console.error(
    `Seed list is incomplete - missing roles: ${missing.join(", ")}. Expected coverage for: ${ALL_USER_ROLES.join(", ")}`,
  );
  process.exit(1);
}

const convex = new ConvexHttpClient(CONVEX_URL);

async function seed() {
  console.log("Seeding staff accounts (one per role)...\n");

  for (const user of SEED_ACCOUNTS) {
    const result = await convex.mutation(api.users.seedUser, {
      email: user.email,
      password: user.password,
      name: user.name,
      role: user.role,
    });

    if (result.created) {
      console.log(`  CREATED: ${user.email} (${user.role}) - id: ${result.id}`);
    } else {
      console.log(`  UPDATED: ${user.email} (${user.role}) - id: ${result.id}`);
    }
  }

  console.log("\nDone. Accounts are not shown in the login UI.");
}

seed().catch(console.error);
