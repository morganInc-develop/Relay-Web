import Anthropic from "@anthropic-ai/sdk"
import * as Sentry from "@sentry/nextjs"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { getDailyLimit, getMonthlyLimit } from "@/lib/ai-limits"
import { AI_SYSTEM_PROMPT } from "@/lib/ai-system-prompt"
import { SanitizationError, sanitizeUserInput } from "@/lib/ai-sanitize"
import { prisma } from "@/lib/prisma"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const TEXT_FIELDS = new Set(["heading", "subheading", "body", "buttonText", "ctaText"])
const SEO_FIELDS = new Set(["metaTitle", "metaDescription", "ogTitle", "ogDescription", "ogImage"])

const UPSELL_MESSAGE = "This request is outside what I can help with. Email hello@morgandev.studio for assistance."
const RATE_LIMIT_UPSELL = "Need more changes this month? Ask about a managed plan"

type ValidAction = "update-text" | "update-seo"

type ProposedAction = {
  action: ValidAction
  page: string
  field: string
  value: string
  reasoning: string
}

interface ChatBody {
  message?: string
}

function getDateParts() {
  const now = new Date()
  const day = now.toISOString().slice(0, 10)
  const month = day.slice(0, 7)
  return { day, month }
}

function parseModelJson(text: string): Record<string, unknown> | null {
  const clean = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()

  try {
    const parsed = JSON.parse(clean)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

async function getKnownPageSlugs(siteId: string): Promise<string[]> {
  const [versionPages, scheduledPages] = await Promise.all([
    prisma.contentVersion.findMany({
      where: { siteId },
      select: { page: true },
      distinct: ["page"],
      orderBy: { createdAt: "desc" },
    }),
    prisma.scheduledChange.findMany({
      where: { siteId },
      select: { page: true },
      distinct: ["page"],
      orderBy: { createdAt: "desc" },
    }),
  ])

  const pages = new Set<string>()
  for (const entry of versionPages) {
    if (entry.page) {
      pages.add(entry.page)
    }
  }

  for (const entry of scheduledPages) {
    if (entry.page) {
      pages.add(entry.page)
    }
  }

  if (pages.size === 0) {
    pages.add("home")
  }

  return Array.from(pages)
}

async function logFailedInteraction(params: {
  userId: string
  siteId: string
  message: string
  failure: string
  modelResponse?: string
}) {
  await prisma.aiChatLog.create({
    data: {
      userId: params.userId,
      siteId: params.siteId,
      message: params.message,
      proposedAction: JSON.stringify({
        action: "failed",
        error: params.failure,
        modelResponse: params.modelResponse ?? null,
      }),
      status: "FAILED",
    },
  })
}

async function incrementUsage(userId: string, day: string, month: string, monthlyUsed: number) {
  await prisma.aiUsage.upsert({
    where: {
      userId_date: {
        userId,
        date: day,
      },
    },
    create: {
      userId,
      date: day,
      month,
      dailyCount: 1,
      monthlyCount: monthlyUsed + 1,
    },
    update: {
      month,
      dailyCount: { increment: 1 },
      monthlyCount: { increment: 1 },
    },
  })
}

function buildSystemPromptContext(domain: string, pages: string[]) {
  const pagesLine = pages.length > 0 ? pages.join(", ") : "unknown"

  return `${AI_SYSTEM_PROMPT}\n\nContext:\n- Domain: ${domain}\n- Available pages: ${pagesLine}`
}

function createSlidingLimiter(limit: number, window: "1 d" | "30 d", prefix: string) {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix,
  })
}

function normalizeProposal(
  modelResult: Record<string, unknown>,
  pageSlugs: string[]
): { type: "proposal"; value: ProposedAction } | { type: "out_of_scope" } | { type: "invalid" } {
  const rawAction = String(modelResult.action ?? "").trim()
  const reasoningRaw = String(modelResult.reasoning ?? "").trim()

  if (rawAction === "out-of-scope" || rawAction === "injection-detected") {
    return { type: "out_of_scope" }
  }

  if (rawAction !== "update-text" && rawAction !== "update-seo") {
    return { type: "invalid" }
  }

  const page = String(modelResult.page ?? "").trim()
  const field = String(modelResult.field ?? "").trim()
  const value = String(modelResult.value ?? "")
  const reasoning = reasoningRaw.length > 0 ? reasoningRaw : "Proposed change based on your request."

  if (!page || !field || !value) {
    return { type: "invalid" }
  }

  if (pageSlugs.length > 0 && !pageSlugs.includes(page)) {
    return { type: "out_of_scope" }
  }

  if (rawAction === "update-text" && !TEXT_FIELDS.has(field)) {
    return { type: "out_of_scope" }
  }

  if (rawAction === "update-seo" && !SEO_FIELDS.has(field)) {
    return { type: "out_of_scope" }
  }

  return {
    type: "proposal",
    value: {
      action: rawAction,
      page,
      field,
      value,
      reasoning,
    },
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      domain: true,
      domainVerified: true,
      linked: true,
    },
  })

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 })
  }

  if (!site.domainVerified || !site.linked) {
    return NextResponse.json({ error: "Site must be verified and linked first" }, { status: 403 })
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true, stripePriceId: true },
  })

  if (!subscription || subscription.status !== "ACTIVE") {
    return NextResponse.json({ error: "Active subscription required" }, { status: 403 })
  }

  let body: ChatBody
  try {
    body = (await req.json()) as ChatBody
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!body.message || typeof body.message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 })
  }

  let sanitizedMessage: string
  try {
    sanitizedMessage = sanitizeUserInput(body.message)
  } catch (error) {
    if (error instanceof SanitizationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Message blocked for safety." }, { status: 400 })
  }

  const dailyLimit = getDailyLimit(subscription.stripePriceId)
  const monthlyLimit = getMonthlyLimit(subscription.stripePriceId)

  if (dailyLimit !== null) {
    const dailyLimiter = createSlidingLimiter(dailyLimit, "1 d", "relayweb:ai:daily")
    const dailyResult = await dailyLimiter.limit(session.user.id)
    if (!dailyResult.success) {
      return NextResponse.json({ error: RATE_LIMIT_UPSELL }, { status: 429 })
    }
  }

  if (monthlyLimit !== null) {
    const monthlyLimiter = createSlidingLimiter(monthlyLimit, "30 d", "relayweb:ai:monthly")
    const monthlyResult = await monthlyLimiter.limit(session.user.id)
    if (!monthlyResult.success) {
      return NextResponse.json({ error: RATE_LIMIT_UPSELL }, { status: 429 })
    }
  }

  const { day, month } = getDateParts()
  const monthUsage = await prisma.aiUsage.findFirst({
    where: { userId: session.user.id, month },
    orderBy: { updatedAt: "desc" },
    select: { monthlyCount: true },
  })
  const monthlyUsed = monthUsage?.monthlyCount ?? 0

  const pages = await getKnownPageSlugs(site.id)
  const systemPrompt = buildSystemPromptContext(site.domain ?? "unknown", pages)

  let modelResult: Record<string, unknown>
  let rawModelResponse = ""
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: sanitizedMessage }],
    })

    rawModelResponse = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n")
      .trim()

    const parsed = parseModelJson(rawModelResponse)
    if (!parsed) {
      await logFailedInteraction({
        userId: session.user.id,
        siteId: site.id,
        message: sanitizedMessage,
        failure: "invalid_json_response",
        modelResponse: rawModelResponse,
      })

      return NextResponse.json(
        {
          error: "AI returned an invalid response. Please try again.",
          code: "INVALID_AI_RESPONSE",
        },
        { status: 422 }
      )
    }

    modelResult = parsed
  } catch (error) {
    Sentry.captureException(error)
    await logFailedInteraction({
      userId: session.user.id,
      siteId: site.id,
      message: sanitizedMessage,
      failure: "provider_error",
      modelResponse: rawModelResponse || undefined,
    })

    return NextResponse.json(
      {
        error: "AI failed to process request. Please try again.",
        code: "AI_PROVIDER_ERROR",
      },
      { status: 502 }
    )
  }

  const normalized = normalizeProposal(modelResult, pages)

  if (normalized.type === "invalid") {
    await logFailedInteraction({
      userId: session.user.id,
      siteId: site.id,
      message: sanitizedMessage,
      failure: "invalid_action_shape",
      modelResponse: rawModelResponse,
    })

    return NextResponse.json(
      {
        error: "AI returned an invalid action format. Please try again.",
        code: "INVALID_ACTION_SHAPE",
      },
      { status: 422 }
    )
  }

  if (normalized.type === "out_of_scope") {
    const chatLog = await prisma.aiChatLog.create({
      data: {
        userId: session.user.id,
        siteId: site.id,
        message: sanitizedMessage,
        proposedAction: JSON.stringify({ action: "out-of-scope", reasoning: UPSELL_MESSAGE }),
        status: "PENDING",
      },
    })

    return NextResponse.json({
      action: "out-of-scope",
      message: UPSELL_MESSAGE,
      upsell: true,
      logId: chatLog.id,
    })
  }

  const chatLog = await prisma.aiChatLog.create({
    data: {
      userId: session.user.id,
      siteId: site.id,
      message: sanitizedMessage,
      proposedAction: JSON.stringify(normalized.value),
      status: "PENDING",
    },
  })

  await incrementUsage(session.user.id, day, month, monthlyUsed)

  return NextResponse.json({
    proposedAction: normalized.value,
    logId: chatLog.id,
  })
}
