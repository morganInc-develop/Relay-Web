import { handlers } from "@/lib/auth"
import { checkRateLimit, rateLimiters } from "@/lib/rate-limit"
import { NextRequest, NextResponse } from "next/server"

function getIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown"
}

export async function GET(req: NextRequest) {
  const rateLimit = await checkRateLimit(rateLimiters.auth, getIp(req))
  if (!rateLimit.success) return rateLimit.response ?? NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  return handlers.GET(req)
}

export async function POST(req: NextRequest) {
  const rateLimit = await checkRateLimit(rateLimiters.auth, getIp(req))
  if (!rateLimit.success) return rateLimit.response ?? NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  return handlers.POST(req)
}
