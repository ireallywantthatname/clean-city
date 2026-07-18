import { describe, expect, test } from "bun:test";
import {
  isValidTransition,
  canRoleSetStatus,
  computeSlaDueAt,
  SLA_HOURS,
  isValidReportLocation,
  createReportSchema,
  ALLOWED_TRANSITIONS,
} from "./schemas";

describe("isValidTransition", () => {
  test("allows documented transitions", () => {
    expect(isValidTransition("NEW", "TRIAGED")).toBe(true);
    expect(isValidTransition("NEW", "REJECTED")).toBe(true);
    expect(isValidTransition("TRIAGED", "ASSIGNED")).toBe(true);
    expect(isValidTransition("ASSIGNED", "IN_PROGRESS")).toBe(true);
    expect(isValidTransition("IN_PROGRESS", "DONE")).toBe(true);
    expect(isValidTransition("BLOCKED", "IN_PROGRESS")).toBe(true);
  });

  test("denies illegal transitions", () => {
    expect(isValidTransition("NEW", "DONE")).toBe(false);
    expect(isValidTransition("DONE", "NEW")).toBe(false);
    expect(isValidTransition("REJECTED", "TRIAGED")).toBe(false);
    expect(isValidTransition("IN_PROGRESS", "NEW")).toBe(false);
  });

  test("matches ALLOWED_TRANSITIONS table for every from-status", () => {
    for (const [from, tos] of Object.entries(ALLOWED_TRANSITIONS)) {
      for (const to of tos) {
        expect(isValidTransition(from, to)).toBe(true);
      }
      expect(isValidTransition(from, "NOT_A_STATUS")).toBe(false);
    }
  });
});

describe("canRoleSetStatus", () => {
  test("ops can set triage/assign/reject statuses", () => {
    expect(canRoleSetStatus("ops", "TRIAGED")).toBe(true);
    expect(canRoleSetStatus("ops", "ASSIGNED")).toBe(true);
    expect(canRoleSetStatus("ops", "REJECTED")).toBe(true);
    expect(canRoleSetStatus("ops", "DONE")).toBe(false);
    expect(canRoleSetStatus("ops", "IN_PROGRESS")).toBe(false);
  });

  test("crew can set field statuses only", () => {
    expect(canRoleSetStatus("crew", "IN_PROGRESS")).toBe(true);
    expect(canRoleSetStatus("crew", "BLOCKED")).toBe(true);
    expect(canRoleSetStatus("crew", "DONE")).toBe(true);
    expect(canRoleSetStatus("crew", "TRIAGED")).toBe(false);
    expect(canRoleSetStatus("crew", "ASSIGNED")).toBe(false);
  });

  test("unknown role cannot set any status", () => {
    expect(canRoleSetStatus("citizen", "NEW")).toBe(false);
    expect(canRoleSetStatus("", "DONE")).toBe(false);
  });
});

describe("computeSlaDueAt / SLA_HOURS", () => {
  const base = new Date("2026-01-15T12:00:00.000Z");

  test("CRITICAL is +4 hours", () => {
    const due = computeSlaDueAt("CRITICAL", base);
    expect(due.getTime() - base.getTime()).toBe(SLA_HOURS.CRITICAL * 3600 * 1000);
    expect(due.toISOString()).toBe("2026-01-15T16:00:00.000Z");
  });

  test("HIGH is +24 hours", () => {
    const due = computeSlaDueAt("HIGH", base);
    expect(due.getTime() - base.getTime()).toBe(24 * 3600 * 1000);
  });

  test("MEDIUM is +72 hours", () => {
    const due = computeSlaDueAt("MEDIUM", base);
    expect(due.getTime() - base.getTime()).toBe(72 * 3600 * 1000);
  });

  test("LOW is +168 hours (7 days)", () => {
    const due = computeSlaDueAt("LOW", base);
    expect(due.getTime() - base.getTime()).toBe(168 * 3600 * 1000);
  });

  test("unknown priority falls back to MEDIUM hours", () => {
    const due = computeSlaDueAt("UNKNOWN", base);
    expect(due.getTime() - base.getTime()).toBe(SLA_HOURS.MEDIUM * 3600 * 1000);
  });
});

describe("isValidReportLocation", () => {
  test("rejects null-island 0,0", () => {
    expect(isValidReportLocation(0, 0)).toBe(false);
  });

  test("rejects non-finite and out-of-range", () => {
    expect(isValidReportLocation(Number.NaN, 3)).toBe(false);
    expect(isValidReportLocation(6, Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidReportLocation(91, 0.1)).toBe(false);
    expect(isValidReportLocation(0.1, 181)).toBe(false);
  });

  test("accepts valid city coordinates including equator/meridian edges that are not both zero", () => {
    expect(isValidReportLocation(6.5244, 3.3792)).toBe(true);
    expect(isValidReportLocation(0, 3.3792)).toBe(true); // equator, not null island
    expect(isValidReportLocation(6.5244, 0)).toBe(true); // prime meridian, not null island
  });
});

describe("createReportSchema location gate", () => {
  test("rejects missing / 0,0 coordinates with validation failure", () => {
    const r1 = createReportSchema.safeParse({
      type: "OVERFLOW",
      lat: 0,
      lng: 0,
      notes: "",
    });
    expect(r1.success).toBe(false);

    const r2 = createReportSchema.safeParse({
      type: "OVERFLOW",
      lat: "0",
      lng: "0",
      notes: "",
    });
    expect(r2.success).toBe(false);
  });

  test("accepts a valid coordinate pair", () => {
    const r = createReportSchema.safeParse({
      type: "ILLEGAL_DUMP",
      lat: "6.5244",
      lng: "3.3792",
      notes: "bin full",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.lat).toBeCloseTo(6.5244);
      expect(r.data.lng).toBeCloseTo(3.3792);
      expect(r.data.type).toBe("ILLEGAL_DUMP");
    }
  });
});
