import { describe, expect, test } from "bun:test";
import { sanitizeForAI, coarsenLocation } from "./sanitize";

describe("sanitizeForAI", () => {
  test("returns placeholder for empty / null input", () => {
    expect(sanitizeForAI(null)).toBe("(no notes provided)");
    expect(sanitizeForAI(undefined)).toBe("(no notes provided)");
    expect(sanitizeForAI("")).toBe("(no notes provided)");
    expect(sanitizeForAI("   ")).toBe("(no notes provided)");
  });

  test("redacts email addresses", () => {
    const out = sanitizeForAI("Contact me at jane.doe@example.com please");
    expect(out).not.toContain("jane.doe@example.com");
    expect(out).toContain("[EMAIL]");
  });

  test("redacts phone numbers", () => {
    const out = sanitizeForAI("Call +1 415-555-2671 or 0803 123 4567");
    expect(out).toContain("[PHONE]");
    expect(out).not.toMatch(/415-555-2671/);
  });

  test("redacts URLs", () => {
    const out = sanitizeForAI("See https://evil.example/path?x=1 for more");
    expect(out).toContain("[URL]");
    expect(out).not.toContain("https://");
  });

  test("redacts SSN-like patterns", () => {
    const out = sanitizeForAI("SSN 123-45-6789 on file");
    expect(out).toContain("[REDACTED]");
    expect(out).not.toContain("123-45-6789");
  });

  test("truncates long text to maxLen with ellipsis", () => {
    const long = "a".repeat(600);
    const out = sanitizeForAI(long, 100);
    expect(out.length).toBeLessThanOrEqual(101); // 100 + …
    expect(out.endsWith("…")).toBe(true);
    expect(out.startsWith("a".repeat(100))).toBe(true);
  });

  test("strips control characters", () => {
    const out = sanitizeForAI("hello\x00\x01world");
    expect(out).toBe("helloworld");
  });
});

describe("coarsenLocation", () => {
  test("rounds to ~3 decimal places", () => {
    const c = coarsenLocation(6.52441234, 3.37925678);
    expect(c.lat).toBe(6.524);
    expect(c.lng).toBe(3.379);
  });
});
