import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import {
  getSiteForUser,
  getUserSubscription,
  tierAllows,
  tierNotAllowedResponse,
} from "@/lib/site-access"
import { updatePageInPayload } from "@/lib/payload-client"
import { createVersionSnapshot, getMaxVersions } from "@/lib/version-snapshot"
import { checkRateLimit, rateLimiters } from "@/lib/rate-limit"
import { triggerClientRebuild } from "@/lib/triggerClientRebuild"
import { ChangeSource, SubscriptionStatus, SubscriptionTier } from "@prisma/client"

interface UpdateTextBody {
  siteId: string
  pageId: string
  pageSlug: string
  fieldKey: string
  previousValue: string
  newValue: string
}

function buildNestedPatch(path: string, value: string): Record<string, unknown> {
  const keys = path.split(".")
  const root: Record<string, unknown> = {}
  let current: Record<string, unknown> = root

  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      current[key] = value
      return
    }
    const next: Record<string, unknown> = {}
    current[key] = next
    current = next
  })

  return root
}

export async function PATCH(req: NextRequest) {
  // 1. Auth check
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Parse body
  let body: UpdateTextBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { siteId, pageId, pageSlug, fieldKey, previousValue, newValue } = body

  if (!siteId || !pageId || !pageSlug || !fieldKey || newValue === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
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
    return tierNotAllowedResponse("text content editing")
  }

  // 4. Rate limit check
  const rateLimit = await checkRateLimit(rateLimiters.contentUpdate, session.user.id)
  if (!rateLimit.success) return rateLimit.response!

  // Save version snapshot BEFORE making any change
  await createVersionSnapshot({
    siteId,
    pageSlug,
    fieldKey,
    previousValue: previousValue ?? "",
    newValue,
    changedBy: session.user.id,
    source: ChangeSource.MANUAL,
    maxVersions: getMaxVersions(subscription.tier),
  })

  // Update content in Payload
  const updateData = buildNestedPatch(fieldKey, newValue)
  const { error: payloadError, status: payloadStatus } = await updatePageInPayload(
    site,
    pageId,
    updateData
  )
  if (payloadError) {
    return NextResponse.json({ error: payloadError }, { status: payloadStatus })
  }

  // Trigger rebuild
  if (site.payloadUrl) {
    await triggerClientRebuild({
      siteRebuildUrl: site.payloadUrl,
      webhookSecret: process.env.RELAYWEB_CLIENT_WEBHOOK_SECRET ?? "",
      source: "platform-text-update",
      pageSlug,
      triggeredBy: session.user.id,
    })
  }

  return NextResponse.json({ success: true, fieldKey, newValue })
}
