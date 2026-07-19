import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALL_USER_ROLES,
  SEED_ACCOUNTS,
  SEED_PASSWORD,
  rolesMissingSeedAccounts,
  seedAccountForRole,
} from "./seed-accounts";
import type { UserRole } from "./types";

describe("seed accounts cover every role", () => {
  test("ALL_USER_ROLES matches UserRole union", () => {
    const roles: UserRole[] = [...ALL_USER_ROLES];
    expect(roles).toContain("ops");
    expect(roles).toContain("crew");
    expect(roles).toHaveLength(2);
  });

  test("every role has exactly one primary seed account", () => {
    expect(rolesMissingSeedAccounts()).toEqual([]);
    for (const role of ALL_USER_ROLES) {
      const account = seedAccountForRole(role);
      expect(account).toBeDefined();
      expect(account!.role).toBe(role);
      expect(account!.email).toContain("@");
      expect(account!.password).toBe(SEED_PASSWORD);
      expect(account!.name.length).toBeGreaterThan(0);
    }
  });

  test("SEED_ACCOUNTS has unique emails and only known roles", () => {
    const emails = SEED_ACCOUNTS.map((a) => a.email);
    expect(new Set(emails).size).toBe(emails.length);
    for (const a of SEED_ACCOUNTS) {
      expect(ALL_USER_ROLES).toContain(a.role);
    }
  });
});

describe("seed credentials are not exposed in the login UI", () => {
  test("login page has no demo account section or seed emails", () => {
    const loginPath = join(import.meta.dir, "../app/login/page.tsx");
    const source = readFileSync(loginPath, "utf8");
    expect(source).not.toContain("Demo accounts");
    expect(source).not.toContain("fillDemo");
    for (const account of SEED_ACCOUNTS) {
      expect(source).not.toContain(account.email);
    }
    expect(source).not.toContain(SEED_PASSWORD);
    expect(source).not.toContain("cleancity.dev");
  });

  test("login page does not import seed-accounts module", () => {
    const loginPath = join(import.meta.dir, "../app/login/page.tsx");
    const source = readFileSync(loginPath, "utf8");
    expect(source).not.toMatch(/seed-accounts/);
  });
});
