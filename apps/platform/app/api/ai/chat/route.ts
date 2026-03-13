import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import {
  getSiteForUser,
  getUserSubscription,
  tierAllows,
  tierNotAllowedResponse,
} from "@/lib/site-access"
import { sanitizeAIInput, buildSystemPrompt, isAllowedAction } from "@/lib/ai-defense"
import { checkAndIncrementAIUsage } from "@/lib/ai-usage"
import { createAIAuditLog } from "@/lib/ai-audit-log"
import { checkRateLimit, rateLimiters } from "@/lib/rate-limit"
import { getAllPagesFromPayload } from "@/lib/payload-client"
import { SubscriptionStatus, SubscriptionTier, AIActionType } from "@prisma/client"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface ChatBody {
  siteId: string
  message: string
}

interface PayloadPageSummary {
  id: string
  slug: string
  title: string
}

interface PayloadPagesResponse {
  docs?: PayloadPageSummary[]
}

function mapActionType(action: string): AIActionType {
  if (action === "update-seo") return AIActionType.SEO_UPDATE
  return AIActionType.CONTENT_UPDATE
}

export async function POST(req: NextRequest) {
  // 1. Auth check
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Parse body
  let body: ChatBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { siteId, message } = body
  if (!siteId || !message) {
    return NextResponse.json({ error: "siteId and message are required" }, { status: 400 })
  }

  // 2. Site ownership check
  const { site, response: accessError } = await getSiteForUser(siteId, session.user.id)
  if (accessError) return accessError
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 })

  // 3. Subscription and tier check
  const subscription = await getUserSubscription(session.user.id)
  if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
    return NextResponse.json({ error: "Active subscription required" }, { status: 403 })
  }
  if (!tierAllows(subscription.tier, SubscriptionTier.TIER1)) {
    return tierNotAllowedResponse("AI assistant")
  }

  // 4. Daily rate limit check (Upstash)
  const tier = subscription.tier
  if (tier === SubscriptionTier.TIER1) {
    const rateLimit = await checkRateLimit(rateLimiters.aiTier1, `${session.user.id}:chat`)
    if (!rateLimit.success) return rateLimit.response!
  } else if (tier === SubscriptionTier.TIER2) {
    const rateLimit = await checkRateLimit(rateLimiters.aiTier2, `${session.user.id}:chat`)
    if (!rateLimit.success) return rateLimit.response!
  }

  // Layer 2 — Input sanitization BEFORE anything else reaches Claude
  const sanitizeResult = sanitizeAIInput(message)
  if (sanitizeResult.blocked) {
    return NextResponse.json(
      { error: sanitizeResult.reason ?? "Message blocked by security filter" },
      { status: 400 }
    )
  }

  // Monthly usage check and increment
  const usageCheck = await checkAndIncrementAIUsage(siteId, tier)
  if (!usageCheck.allowed) return usageCheck.response!

  // Fetch site pages for context
  let pages: Array<{ id: string; slug: string; title: string }> = []
  try {
    const { data } = await getAllPagesFromPayload(site)
    pages = ((data as PayloadPagesResponse | null)?.docs ?? []).map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
    }))
  } catch {
    // Continue with empty pages — AI will handle it
  }

  // Layer 1 — Call Claude Haiku with hardened system prompt
  const systemPrompt = buildSystemPrompt(pages)
  let aiResponseText = ""
  let parsedResponse: Record<string, unknown> = {}

  try {
    const messageResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: sanitizeResult.sanitized,
        },
      ],
    })

    aiResponseText =
      messageResponse.content[0].type === "text" ? messageResponse.content[0].text : ""

    const cleanText = aiResponseText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim()

    // Parse the JSON response
    parsedResponse = JSON.parse(cleanText)
  } catch {
    // Log failed AI call then return error
    await createAIAuditLog({
      siteId,
      userId: session.user.id,
      actionType: AIActionType.CONTENT_UPDATE,
      pageSlug: "unknown",
      fieldKey: null,
      previousValue: null,
      newValue: null,
      userPrompt: sanitizeResult.sanitized,
      aiResponse: aiResponseText,
      wasApplied: false,
      wasRejected: true,
    })
    return NextResponse.json({ error: "AI failed to process request" }, { status: 500 })
  }

  // Layer 3 — Validate the action is allowed
  const action = String(parsedResponse.action ?? "")
  if (!isAllowedAction(action)) {
    await createAIAuditLog({
      siteId,
      userId: session.user.id,
      actionType: AIActionType.CONTENT_UPDATE,
      pageSlug: String(parsedResponse.pageSlug ?? "unknown"),
      fieldKey: parsedResponse.fieldKey ? String(parsedResponse.fieldKey) : null,
      previousValue: null,
      newValue: parsedResponse.newValue ? String(parsedResponse.newValue) : null,
      userPrompt: sanitizeResult.sanitized,
      aiResponse: aiResponseText,
      wasApplied: false,
      wasRejected: true,
    })
    return NextResponse.json(
      { error: "AI attempted an unauthorized action" },
      { status: 400 }
    )
  }

  // Log the AI suggestion (not yet applied)
  await createAIAuditLog({
    siteId,
    userId: session.user.id,
    actionType: mapActionType(action),
    pageSlug: String(parsedResponse.pageSlug ?? "unknown"),
    fieldKey: parsedResponse.fieldKey ? String(parsedResponse.fieldKey) : null,
    previousValue: null,
    newValue: parsedResponse.newValue ? String(parsedResponse.newValue) : null,
    userPrompt: sanitizeResult.sanitized,
    aiResponse: aiResponseText,
    wasApplied: false,
    wasRejected: false,
  })

  // Return AI suggestion with confirmation required flag
  return NextResponse.json({
    action: parsedResponse.action,
    pageSlug: parsedResponse.pageSlug ?? null,
    pageId: parsedResponse.pageId ?? null,
    fieldKey: parsedResponse.fieldKey ?? null,
    newValue: parsedResponse.newValue ?? null,
    humanMessage: parsedResponse.humanMessage ?? "I can help with that.",
    requiresConfirmation:
      typeof parsedResponse.requiresConfirmation === "boolean"
        ? parsedResponse.requiresConfirmation
        : true,
    confidenceScore:
      typeof parsedResponse.confidenceScore === "number"
        ? parsedResponse.confidenceScore
        : 0,
    usage: {
      used: usageCheck.monthlyUsed,
      limit: usageCheck.monthlyLimit,
    },
  })
}
