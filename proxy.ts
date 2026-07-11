import { NextResponse, type NextRequest } from "next/server";

import {
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
} from "@/lib/constants";

/**
 * Network boundary for the app (Next.js 16 replaces middleware.ts with proxy.ts).
 *
 * Sole job: rate-limit PDF export (§8, 10 requests/minute per IP). Chromium is
 * expensive to drive, so an unthrottled endpoint is a cheap way to exhaust the
 * server's memory.
 *
 * The counter lives in memory, which is deliberate: the app is stateless with no
 * database (§2), and the deployment target is a single Docker container. Scaling
 * to multiple replicas would need a shared store (e.g. Redis) — until then, each
 * replica would enforce its own quota.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Drops expired buckets so the map cannot grow without bound under a flood. */
function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  // Left-most entry is the original client; the rest are proxies.
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function checkRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  if (buckets.size > 5_000) sweep(now);

  const bucket = buckets.get(ip);

  if (!bucket || bucket.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    buckets.set(ip, fresh);
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetAt: fresh.resetAt,
    };
  }

  bucket.count += 1;
  return {
    allowed: bucket.count <= RATE_LIMIT_MAX_REQUESTS,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - bucket.count),
    resetAt: bucket.resetAt,
  };
}

export default function proxy(request: NextRequest) {
  const { allowed, remaining, resetAt } = checkRateLimit(clientIp(request));
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

  if (!allowed) {
    return NextResponse.json(
      {
        error: "Too many requests",
        detail: `Limit is ${RATE_LIMIT_MAX_REQUESTS} exports per minute. Try again in ${retryAfter}s.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
          "RateLimit-Remaining": "0",
        },
      },
    );
  }

  const response = NextResponse.next();
  response.headers.set("RateLimit-Limit", String(RATE_LIMIT_MAX_REQUESTS));
  response.headers.set("RateLimit-Remaining", String(remaining));
  return response;
}

export const config = {
  matcher: "/api/export-pdf",
};
