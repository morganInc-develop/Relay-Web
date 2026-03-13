import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import {
  getSiteForUser,
  getUserSubscription,
  tierAllows,
  tierNotAllowedResponse,
} from "@/lib/site-access"
import { getAllPagesFromPayload } from "@/lib/payload-client"
import { checkRateLimit, rateLimiters } from "@/lib/rate-limit"
import { SubscriptionStatus, SubscriptionTier } from "@prisma/client"

export async function GET(req: NextRequest) {
  // 1. Auth check
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const siteId = searchParams.get("siteId")

  if (!siteId) {
    return NextResponse.json({ error: "siteId is required" }, { status: 400 })
  }

  // 2. Site ownership check
  const { site, response: accessError } = await getSiteForUser(siteId, session.user.id)
  if (accessError) return accessError
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 })

  // 3. Tier check
  const subscription = await getUserSubscription(session.user.id)
  if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
    return NextResponse.json({ error: "Active subscription required" }, { status: 403 })
  }
  if (!tierAllows(subscription.tier, SubscriptionTier.TIER1)) {
    return tierNotAllowedResponse("content access")
  }

  // 4. Rate limit check
  const rateLimit = await checkRateLimit(rateLimiters.contentUpdate, session.user.id)
  if (!rateLimit.success) return rateLimit.response!

  // Fetch all pages from Payload
  const { data, error, status } = await getAllPagesFromPayload(site)
  if (error) return NextResponse.json({ error }, { status })

  return NextResponse.json({ pages: data })
}
