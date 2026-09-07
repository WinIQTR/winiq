// In-memory rate limiter for low-frequency, admin-only actions that call
// external APIs (e.g. import endpoints). This intentionally avoids a database
// migration: it resets on server restart and does not share state across
// multiple server instances. That's an acceptable trade-off for an
// admin-only safeguard against accidental rapid-fire clicks / double
// submits, but it is NOT a substitute for durable rate limiting if this
// project is ever deployed across multiple instances (e.g. serverless with
// several concurrent function instances). For anything user-facing or
// security-critical, prefer a persistent store (see LoginAttempt table).

type Bucket = {
  count: number;
  windowStartedAt: number;
};

const buckets = new Map<string, Bucket>();

export function checkInMemoryRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStartedAt >= windowMs) {
    buckets.set(key, { count: 1, windowStartedAt: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= maxRequests) {
    const retryAfterSeconds = Math.ceil(
      (bucket.windowStartedAt + windowMs - now) / 1000,
    );
    return { allowed: false, retryAfterSeconds };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
