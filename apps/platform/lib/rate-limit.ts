import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { NextResponse } from "next/server"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const rateLimiters = {
  // Content update routes — 30 requests per hour per user
  contentUpdate: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 h"),
    prefix: "rl:content",
  }),

  // AI chatbot — Tier 1: 5 per day
  aiTier1: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 d"),
    prefix: "rl:ai:tier1",
  }),

  // AI chatbot — Tier 2: 10 per day
  aiTier2: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 d"),
    prefix: "rl:ai:tier2",
  }),

  // Domain verification — 5 attempts per hour per user
  domainVerify: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 h"),
    prefix: "rl:domain",
  }),

  // Auth attempts — 5 per 15 minutes per IP
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "15 m"),
    prefix: "rl:auth",
  }),

  // Image uploads — 20 per hour per user
  imageUpload: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 h"),
    prefix: "rl:upload",
  }),

  // Stripe webhook — 100 per minute (by IP)
  stripeWebhook: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "1 m"),
    prefix: "rl:stripe",
  }),

  // SEO audit route — separate from AI daily cap
  seoAudit: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 h"),
    prefix: "rl:seo",
  }),
}

export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<{ success: boolean; response?: NextResponse }> {
  const result = await limiter.limit(identifier)

  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: "Rate limit exceeded. Please slow down and try again.",
          resetAt: new Date(result.reset).toISOString(),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": result.limit.toString(),
            "X-RateLimit-Remaining": result.remaining.toString(),
            "X-RateLimit-Reset": result.reset.toString(),
            "Retry-After": Math.ceil((result.reset - Date.now()) / 1000).toString(),
          },
        }
      ),
    }
  }

  return { success: true }
}
