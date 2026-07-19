/**
 * Seed/demo staff accounts — server & scripts only.
 * Never import this into client UI; credentials must not be shown in the app.
 */
import type { UserRole } from "@/lib/types";

export interface SeedAccount {
  email: string;
  /** Default seed password (dev/demo only). */
  password: string;
  name: string;
  role: UserRole;
}

/** Canonical password for all seed accounts. */
export const SEED_PASSWORD = "password123";

/**
 * Exactly one primary seed account per app role.
 * Keep this list in sync with SQL seed migration and scripts/seed-users.ts.
 */
export const SEED_ACCOUNTS: readonly SeedAccount[] = [
  {
    email: "ops@cleancity.dev",
    password: SEED_PASSWORD,
    name: "Ops Admin",
    role: "ops",
  },
  {
    email: "crew@cleancity.dev",
    password: SEED_PASSWORD,
    name: "Crew Lead",
    role: "crew",
  },
] as const;

/** All roles the product defines — must each have a seed account. */
export const ALL_USER_ROLES: readonly UserRole[] = ["ops", "crew"] as const;

export function seedAccountForRole(role: UserRole): SeedAccount | undefined {
  return SEED_ACCOUNTS.find((a) => a.role === role);
}

export function rolesMissingSeedAccounts(
  accounts: readonly { role: string }[] = SEED_ACCOUNTS,
): UserRole[] {
  const covered = new Set(accounts.map((a) => a.role));
  return ALL_USER_ROLES.filter((r) => !covered.has(r));
}
