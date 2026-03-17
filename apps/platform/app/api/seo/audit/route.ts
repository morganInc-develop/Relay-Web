import { auth } from "@/lib/auth"
import { getPageFromPayload } from "@/lib/payload-client"
import { prisma } from "@/lib/prisma"
import { checkRateLimit, rateLimiters } from "@/lib/rate-limit"
import { getUserSubscription } from "@/lib/site-access"
import Anthropic from "@anthropic-ai/sdk"
import { Prisma, SubscriptionStatus, SubscriptionTier } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface AuditBody {
  page: string
  keywords: string[]
}

interface AuditResultShape {
  scores: {
    metaTitle: number
    metaDescription: number
    keywords: number
    og: number
  }
  recommendations: string[]
  overallScore: number
}

function isAuditResultShape(value: unknown): value is AuditResultShape {
  if (!value || typeof value !== "object") return false
  const candidate = value as Record<string, unknown>
  if (!candidate.scores || typeof candidate.scores !== "object") return false
  if (!Array.isArray(candidate.recommendations)) return false
  if (typeof candidate.overallScore !== "number") return false

  const scores = candidate.scores as Record<string, unknown>
  return (
    typeof scores.metaTitle === "number" &&
    typeof scores.metaDescription === "number" &&
    typeof scores.keywords === "number" &&
    typeof scores.og === "number"
  )
}

function cleanJson(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()
}

function getLimits(tier: SubscriptionTier): { scanLimit: number | null; keywordLimit: number } {
  if (tier === SubscriptionTier.TIER3) return { scanLimit: null, keywordLimit: 999 }
  if (tier === SubscriptionTier.TIER2) return { scanLimit: 20, keywordLimit: 10 }
  return { scanLimit: 5, keywordLimit: 3 }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seoRateLimit = await checkRateLimit(rateLimiters.seoAudit, session.user.id)
  if (!seoRateLimit.success) return seoRateLimit.response!

  let body: AuditBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!body.page || !Array.isArray(body.keywords) || body.keywords.length === 0) {
    return NextResponse.json({ error: "page and keywords are required" }, { status: 400 })
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

  const { scanLimit, keywordLimit } = getLimits(subscription.tier)
  if (body.keywords.length > keywordLimit) {
    return NextResponse.json(
      { error: `Your plan allows ${keywordLimit} keywords per audit.` },
      { status: 400 }
    )
  }

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const scanCount = await prisma.sEOAudit.count({
    where: {
      siteId: site.id,
      createdAt: { gte: monthStart },
    },
  })

  if (scanLimit !== null && scanCount >= scanLimit) {
    return NextResponse.json({ error: "Monthly scan limit reached" }, { status: 429 })
  }

  const { data: pageData, error: pageError, status: pageStatus } = await getPageFromPayload(site, body.page)
  if (pageError) return NextResponse.json({ error: pageError }, { status: pageStatus })

  const pageDoc = (pageData as { docs?: Array<Record<string, unknown>> } | null)?.docs?.[0]
  if (!pageDoc) return NextResponse.json({ error: "Page not found" }, { status: 404 })

  const meta = (pageDoc.meta as Record<string, unknown> | undefined) ?? {}
  const metaTitle = String(meta.title ?? "")
  const metaDescription = String(meta.description ?? "")
  const ogTitle = String(meta.ogTitle ?? "")
  const ogDescription = String(meta.ogDescription ?? "")

  const systemPrompt = `You are an SEO audit assistant. Analyse the provided page SEO fields and keywords.
Return ONLY valid JSON with this exact shape:
{
  "scores": {
    "metaTitle": 0-100,
    "metaDescription": 0-100,
    "keywords": 0-100,
    "og": 0-100
  },
  "recommendations": ["string", ...],
  "overallScore": 0-100
}
Do not include any text outside the JSON object.`

  const userPrompt = `Page: ${body.page}
Keywords: ${body.keywords.join(", ")}
metaTitle: ${metaTitle}
metaDescription: ${metaDescription}
ogTitle: ${ogTitle}
ogDescription: ${ogDescription}`

  let result: AuditResultShape
  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    })

    const textBlock = message.content.find((block) => block.type === "text")
    const text = textBlock && textBlock.type === "text" ? textBlock.text : ""
    const parsed = JSON.parse(cleanJson(text)) as unknown
    if (!isAuditResultShape(parsed)) {
      return NextResponse.json({ error: "AI returned invalid audit format" }, { status: 502 })
    }

    result = parsed
  } catch {
    return NextResponse.json({ error: "AI audit failed — please try again" }, { status: 500 })
  }

  await prisma.sEOAudit.create({
    data: {
      siteId: site.id,
      page: body.page,
      keywords: body.keywords,
      score: result.overallScore,
      results: result as unknown as Prisma.InputJsonValue,
    },
  })

  const scansRemaining = scanLimit === null ? null : Math.max(scanLimit - (scanCount + 1), 0)

  return NextResponse.json({
    ...result,
    scansRemaining,
  })
}
