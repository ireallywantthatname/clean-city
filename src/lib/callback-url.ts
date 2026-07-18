/**
 * Safe post-login redirect helper.
 * Only same-origin relative paths are accepted (no protocol-relative or absolute URLs).
 */
export function isSafeCallbackUrl(url: string | null | undefined): url is string {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith("/")) return false;
  // Protocol-relative (//evil.com) or embedded scheme
  if (trimmed.startsWith("//")) return false;
  if (trimmed.includes("://")) return false;
  // Block backslash tricks and control characters
  if (trimmed.includes("\\") || /[\x00-\x1f]/.test(trimmed)) return false;
  return true;
}

/**
 * Resolve where to send the user after login.
 * Prefers a safe callbackUrl; otherwise role-based default (/ops or /crew).
 */
export function resolvePostLoginPath(
  callbackUrl: string | null | undefined,
  role: string | null | undefined,
): string {
  if (isSafeCallbackUrl(callbackUrl)) return callbackUrl;
  if (role === "ops") return "/ops";
  return "/crew";
}
