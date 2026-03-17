import { auth } from "@/lib/auth"
import {
  applySeoFieldUpdate,
  ContentMutationError,
  SeoField,
} from "@/lib/content-mutations"
import { prisma } from "@/lib/prisma"
import { checkRateLimit, rateLimiters } from "@/lib/rate-limit"
import { getUserSubscription } from "@/lib/site-access"
import { SubscriptionStatus } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

interface UpdateSeoBody {
  page: string
  field: SeoField
  value: string
}

const allowedFields = new Set<SeoField>([
  "metaTitle",
  "metaDescription",
  "ogTitle",
  "ogDescription",
  "ogImage",
])

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rateLimit = await checkRateLimit(rateLimiters.contentUpdate, session.user.id)
  if (!rateLimit.success) return rateLimit.response!

  let body: UpdateSeoBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { page, field, value } = body
  if (!page || !field || value === undefined) {
    return NextResponse.json({ error: "page, field, and value are required" }, { status: 400 })
  }
  if (!allowedFields.has(field)) {
    return NextResponse.json({ error: "Invalid SEO field" }, { status: 400 })
  }

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
  })
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 })
  if (!site.domainVerified || !site.linked) {
    return NextResponse.json({ error: "Site must be verified and linked first" }, { status: 403 })
  }

  const subscription = await getUserSubscription(session.user.id)
  if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
    return NextResponse.json({ error: "Active subscription required" }, { status: 403 })
  }

  try {
    const result = await applySeoFieldUpdate({
      site,
      page,
      field,
      value,
      userId: session.user.id,
      subscriptionTier: subscription.tier,
    })

    return NextResponse.json({
      success: true,
      versionsRemaining: result.versionsRemaining,
    })
  } catch (error) {
    if (error instanceof ContentMutationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[Content] SEO update failed:", error)
    return NextResponse.json({ error: "Failed to update SEO field" }, { status: 500 })
  }
}
