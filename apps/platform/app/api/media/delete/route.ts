import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { getSiteForUser, getUserSubscription } from "@/lib/site-access"
import { deleteFromR2, buildR2Key } from "@/lib/r2"
import { checkRateLimit, rateLimiters } from "@/lib/rate-limit"
import { SubscriptionStatus } from "@prisma/client"

interface DeleteBody {
  siteId: string
  folder: string
  filename: string
}

export async function DELETE(req: NextRequest) {
  // 1. Auth check
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: DeleteBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { siteId, folder, filename } = body
  if (!siteId || !folder || !filename) {
    return NextResponse.json({ error: "siteId, folder, and filename are required" }, { status: 400 })
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

  // Delete from R2
  try {
    const key = buildR2Key(siteId, folder, filename)
    await deleteFromR2(key)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 })
  }
}
