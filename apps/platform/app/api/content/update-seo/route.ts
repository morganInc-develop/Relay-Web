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

interface UpdateSeoBody {
  siteId: string
  pageId: string
  pageSlug: string
  metaTitle?: string
  metaDescription?: string
  ogImage?: string
  noIndex?: boolean
  previousValues: {
    metaTitle?: string
    metaDescription?: string
    ogImage?: string
    noIndex?: boolean
  }
}

export async function PATCH(req: NextRequest) {
  // 1. Auth check
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Parse body
  let body: UpdateSeoBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { siteId, pageId, pageSlug, metaTitle, metaDescription, ogImage, noIndex, previousValues } = body

  if (!siteId || !pageId || !pageSlug) {
    return NextResponse.json({ error: "siteId, pageId, and pageSlug are required" }, { status: 400 })
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
    return tierNotAllowedResponse("SEO editing")
  }

  // 4. Rate limit check
  const rateLimit = await checkRateLimit(rateLimiters.contentUpdate, session.user.id)
  if (!rateLimit.success) return rateLimit.response!

  const maxVersions = getMaxVersions(subscription.tier)

  // Save version snapshot for each changed SEO field
  const seoFields: Record<string, { prev: string; next: string }> = {}
  if (metaTitle !== undefined)
    seoFields["meta.title"] = { prev: previousValues.metaTitle ?? "", next: metaTitle }
  if (metaDescription !== undefined)
    seoFields["meta.description"] = { prev: previousValues.metaDescription ?? "", next: metaDescription }
  if (ogImage !== undefined)
    seoFields["meta.ogImage"] = { prev: previousValues.ogImage ?? "", next: ogImage }
  if (noIndex !== undefined)
    seoFields["meta.noIndex"] = {
      prev: String(previousValues.noIndex ?? false),
      next: String(noIndex),
    }

  for (const [fieldKey, { prev, next }] of Object.entries(seoFields)) {
    await createVersionSnapshot({
      siteId,
      pageSlug,
      fieldKey,
      previousValue: prev,
      newValue: next,
      changedBy: session.user.id,
      source: ChangeSource.MANUAL,
      maxVersions,
    })
  }

  // Update SEO in Payload
  const updateData: Record<string, unknown> = { meta: {} }
  if (metaTitle !== undefined) (updateData.meta as Record<string, unknown>).title = metaTitle
  if (metaDescription !== undefined) (updateData.meta as Record<string, unknown>).description = metaDescription
  if (ogImage !== undefined) (updateData.meta as Record<string, unknown>).ogImage = ogImage
  if (noIndex !== undefined) (updateData.meta as Record<string, unknown>).noIndex = noIndex

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
      source: "platform-seo-update",
      pageSlug,
      triggeredBy: session.user.id,
    })
  }

  return NextResponse.json({ success: true, updated: Object.keys(seoFields) })
}
