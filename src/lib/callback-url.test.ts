import { describe, expect, test } from "bun:test";
import { isSafeCallbackUrl, resolvePostLoginPath } from "./callback-url";

describe("isSafeCallbackUrl", () => {
  test("accepts same-app relative paths", () => {
    expect(isSafeCallbackUrl("/ops")).toBe(true);
    expect(isSafeCallbackUrl("/crew")).toBe(true);
    expect(isSafeCallbackUrl("/ops?tab=map")).toBe(true);
    expect(isSafeCallbackUrl("/reports/abc")).toBe(true);
  });

  test("rejects absolute, protocol-relative, and empty values", () => {
    expect(isSafeCallbackUrl(null)).toBe(false);
    expect(isSafeCallbackUrl(undefined)).toBe(false);
    expect(isSafeCallbackUrl("")).toBe(false);
    expect(isSafeCallbackUrl("https://evil.com")).toBe(false);
    expect(isSafeCallbackUrl("//evil.com/phish")).toBe(false);
    expect(isSafeCallbackUrl("ops")).toBe(false);
    expect(isSafeCallbackUrl("\\evil")).toBe(false);
    expect(isSafeCallbackUrl("/path\nwith-control")).toBe(false);
  });
});

describe("resolvePostLoginPath", () => {
  test("prefers safe callbackUrl over role default", () => {
    expect(resolvePostLoginPath("/crew", "ops")).toBe("/crew");
  });

  test("falls back to role routing when callback missing or unsafe", () => {
    expect(resolvePostLoginPath(null, "ops")).toBe("/ops");
    expect(resolvePostLoginPath("//evil.com", "ops")).toBe("/ops");
    expect(resolvePostLoginPath(null, "crew")).toBe("/crew");
    expect(resolvePostLoginPath(null, null)).toBe("/crew");
  });
});
