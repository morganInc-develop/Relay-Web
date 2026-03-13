import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import {
  getSiteForUser,
  getUserSubscription,
  tierAllows,
  tierNotAllowedResponse,
} from "@/lib/site-access"
import { createAIAuditLog } from "@/lib/ai-audit-log"
import { AIActionType, SubscriptionStatus, SubscriptionTier } from "@prisma/client"
import { checkRateLimit, rateLimiters } from "@/lib/rate-limit"

interface RejectBody {
  siteId: string
  pageSlug: string
  fieldKey: string | null
  newValue: string | null
  userPrompt: string
}

function actionTypeForField(fieldKey: string | null): AIActionType {
  if (fieldKey?.startsWith("meta.")) return AIActionType.SEO_UPDATE
  return AIActionType.CONTENT_UPDATE
}

export async function POST(req: NextRequest) {
  // 1. Auth check
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Parse body
  let body: RejectBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { siteId, pageSlug, fieldKey, newValue, userPrompt } = body
  if (!siteId || !pageSlug) {
    return NextResponse.json({ error: "siteId and pageSlug are required" }, { status: 400 })
  }

  // 2. Site ownership check
  const { response: accessError } = await getSiteForUser(siteId, session.user.id)
  if (accessError) return accessError

  // 3. Tier check
  const subscription = await getUserSubscription(session.user.id)
  if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
    return NextResponse.json({ error: "Active subscription required" }, { status: 403 })
  }
  if (!tierAllows(subscription.tier, SubscriptionTier.TIER1)) {
    return tierNotAllowedResponse("AI suggestions")
  }

  // 4. Rate limit check
  if (subscription.tier === SubscriptionTier.TIER1) {
    const rateLimit = await checkRateLimit(rateLimiters.aiTier1, `${session.user.id}:reject`)
    if (!rateLimit.success) return rateLimit.response!
  } else if (subscription.tier === SubscriptionTier.TIER2) {
    const rateLimit = await checkRateLimit(rateLimiters.aiTier2, `${session.user.id}:reject`)
    if (!rateLimit.success) return rateLimit.response!
  }

  await createAIAuditLog({
    siteId,
    userId: session.user.id,
    actionType: actionTypeForField(fieldKey),
    pageSlug,
    fieldKey,
    previousValue: null,
    newValue,
    userPrompt,
    aiResponse: "Rejected by user",
    wasApplied: false,
    wasRejected: true,
  })

  return NextResponse.json({ success: true })
}
