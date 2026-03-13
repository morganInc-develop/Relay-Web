import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { getSiteForUser, getUserSubscription } from "@/lib/site-access"
import { getReadSignedUrl, buildR2Key } from "@/lib/r2"
import { checkRateLimit, rateLimiters } from "@/lib/rate-limit"
import { SubscriptionStatus } from "@prisma/client"

export async function GET(req: NextRequest) {
  // 1. Auth check
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const siteId = searchParams.get("siteId")
  const folder = searchParams.get("folder") ?? "media"
  const filename = searchParams.get("filename")

  if (!siteId || !filename) {
    return NextResponse.json({ error: "siteId and filename are required" }, { status: 400 })
  }

  // 2. Site ownership check
  const { response: accessError } = await getSiteForUser(siteId, session.user.id)
  if (accessError) return accessError

  // 3. Tier check
  const subscription = await getUserSubscription(session.user.id)
  if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
    return NextResponse.json({ error: "Active subscription required" }, { status: 403 })
  }

  // 4. Rate limit check
  const rateLimit = await checkRateLimit(rateLimiters.imageUpload, session.user.id)
  if (!rateLimit.success) return rateLimit.response!

  // Generate signed URL — expires in 1 hour
  try {
    const key = buildR2Key(siteId, folder, filename)
    const signedUrl = await getReadSignedUrl(key)
    return NextResponse.json({ url: signedUrl, expiresIn: 3600 })
  } catch {
    return NextResponse.json({ error: "Failed to generate signed URL" }, { status: 500 })
  }
}
