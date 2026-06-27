/**
 * Rate limiting for AI endpoints — server-side only.
 * Simple in-memory sliding-window per-key per-hour.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

const DEFAULT_LIMIT = parseInt(process.env.AI_RATE_LIMIT_PER_HOUR || "30", 10) || 30;
const INTERNAL_LIMIT = parseInt(process.env.AI_INTERNAL_RATE_LIMIT || "200", 10) || 200;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export function checkRateLimit(key: string, limit: number = DEFAULT_LIMIT): RateLimitResult {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + 3_600_000 });
    return { allowed: true, remaining: limit - 1 };
  }
  if (entry.count >= limit) return { allowed: false, remaining: 0 };
  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count };
}

export function checkInternalRateLimit(key: string): RateLimitResult {
  return checkRateLimit(`internal:${key}`, INTERNAL_LIMIT);
}

export function checkUserRateLimit(userId: string): RateLimitResult {
  return checkRateLimit(`user:${userId}`, DEFAULT_LIMIT);
}

export function checkIpRateLimit(ip: string): RateLimitResult {
  return checkRateLimit(`ip:${ip}`, DEFAULT_LIMIT * 2);
}
