interface RateBucket {
  timestamps: number[];
}

const buckets = new Map<string, RateBucket>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  remaining?: number;
}

/**
 * Sliding window rate limiter per key (e.g. IP address or email)
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  const existing = buckets.get(key) || { timestamps: [] };
  existing.timestamps = existing.timestamps.filter((ts) => ts > windowStart);

  if (existing.timestamps.length >= maxRequests) {
    const oldestInWindow = existing.timestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldestInWindow + windowMs - now) / 1000));
    buckets.set(key, existing);
    return {
      allowed: false,
      retryAfterSeconds,
      remaining: 0,
    };
  }

  existing.timestamps.push(now);
  buckets.set(key, existing);

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - existing.timestamps.length),
  };
}

/**
 * Extracts client IP cleanly behind Vercel / Render proxies
 */
export function getClientIp(req: any): string {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req?.socket?.remoteAddress || req?.ip || 'unknown';
}

/**
 * Basic honeypot check against automated bots
 */
export function isBotHoneypotTriggered(body: any): boolean {
  if (!body || typeof body !== 'object') return false;
  const trap = body.website || body.company_url || body._hp;
  return typeof trap === 'string' && trap.trim().length > 0;
}
