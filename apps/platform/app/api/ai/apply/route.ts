import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import {
  getSiteForUser,
  getUserSubscription,
  tierAllows,
  tierNotAllowedResponse,
} from "@/lib/site-access"
import { createAIAuditLog } from "@/lib/ai-audit-log"
import { createVersionSnapshot, getMaxVersions } from "@/lib/version-snapshot"
import { updatePageInPayload, getPageFromPayload } from "@/lib/payload-client"
import { triggerClientRebuild } from "@/lib/triggerClientRebuild"
import { ChangeSource, SubscriptionStatus, AIActionType, SubscriptionTier } from "@prisma/client"
import { checkRateLimit, rateLimiters } from "@/lib/rate-limit"

interface ApplyBody {
  siteId: string
  pageId: string
  pageSlug: string
  fieldKey: string
  newValue: string
  userPrompt: string
}

interface PayloadPageDocument {
  [key: string]: unknown
}

interface PayloadPageDocsResponse {
  docs?: PayloadPageDocument[]
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

function actionTypeForField(fieldKey: string): AIActionType {
  if (fieldKey.startsWith("meta.")) return AIActionType.SEO_UPDATE
  return AIActionType.CONTENT_UPDATE
}

export async function POST(req: NextRequest) {
  // 1. Auth check
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Parse body
  let body: ApplyBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { siteId, pageId, pageSlug, fieldKey, newValue, userPrompt } = body
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
    return tierNotAllowedResponse("AI apply")
  }

  // 4. Rate limit check
  if (subscription.tier === SubscriptionTier.TIER1) {
    const rateLimit = await checkRateLimit(rateLimiters.aiTier1, `${session.user.id}:apply`)
    if (!rateLimit.success) return rateLimit.response!
  } else if (subscription.tier === SubscriptionTier.TIER2) {
    const rateLimit = await checkRateLimit(rateLimiters.aiTier2, `${session.user.id}:apply`)
    if (!rateLimit.success) return rateLimit.response!
  }

  // Fetch current value for snapshot
  let previousValue = ""
  try {
    const { data: pageData } = await getPageFromPayload(site, pageSlug)
    const page = (pageData as PayloadPageDocsResponse | null)?.docs?.[0]
    if (page) {
      const parts = fieldKey.split(".")
      let value: unknown = page
      for (const part of parts) {
        value = (value as Record<string, unknown>)?.[part]
      }
      previousValue = String(value ?? "")
    }
  } catch {
    // Continue — snapshot will have empty previousValue
  }

  // Save version snapshot BEFORE applying
  await createVersionSnapshot({
    siteId,
    pageSlug,
    fieldKey,
    previousValue,
    newValue,
    changedBy: session.user.id,
    source: ChangeSource.AI,
    maxVersions: getMaxVersions(subscription.tier),
  })

  // Apply change to Payload
  const updateData = buildNestedPatch(fieldKey, newValue)
  const { error: payloadError, status: payloadStatus } = await updatePageInPayload(
    site,
    pageId,
    updateData
  )

  if (payloadError) {
    // Log failed application
    await createAIAuditLog({
      siteId,
      userId: session.user.id,
      actionType: actionTypeForField(fieldKey),
      pageSlug,
      fieldKey,
      previousValue,
      newValue,
      userPrompt,
      aiResponse: "Applied by user confirmation",
      wasApplied: false,
      wasRejected: true,
    })
    return NextResponse.json({ error: payloadError }, { status: payloadStatus })
  }

  // Log successful application
  await createAIAuditLog({
    siteId,
    userId: session.user.id,
    actionType: actionTypeForField(fieldKey),
    pageSlug,
    fieldKey,
    previousValue,
    newValue,
    userPrompt,
    aiResponse: "Applied by user confirmation",
    wasApplied: true,
    wasRejected: false,
  })

  // Trigger rebuild
  if (site.payloadUrl) {
    await triggerClientRebuild({
      siteRebuildUrl: site.payloadUrl,
      webhookSecret: process.env.RELAYWEB_CLIENT_WEBHOOK_SECRET ?? "",
      source: "platform-ai-apply",
      pageSlug,
      triggeredBy: session.user.id,
    })
  }

  return NextResponse.json({ success: true, fieldKey, newValue })
}
