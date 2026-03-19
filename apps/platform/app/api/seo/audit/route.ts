import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getKeywordLimit, getScanLimit } from "@/lib/seo-limits"
import Anthropic from "@anthropic-ai/sdk"
import { NextRequest, NextResponse } from "next/server"

interface AuditBody {
  page?: string
  keywords?: unknown
}

interface PayloadPageResponse {
  docs?: Array<Record<string, unknown>>
}

interface AuditResult {
  scores: {
    metaTitle: number
    metaDescription: number
    keywords: number
    og: number
  }
  recommendations: string[]
  overallScore: number
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function getNestedValue(value: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = value

  for (const segment of path) {
    if (!current || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[segment]
  }

  return current
}

function isAuditResult(value: unknown): value is AuditResult {
  if (!value || typeof value !== "object") return false

  const candidate = value as Record<string, unknown>
  const scores = candidate.scores as Record<string, unknown> | undefined

  return (
    !!scores &&
    typeof scores.metaTitle === "number" &&
    typeof scores.metaDescription === "number" &&
    typeof scores.keywords === "number" &&
    typeof scores.og === "number" &&
    Array.isArray(candidate.recommendations) &&
    candidate.recommendations.every((item) => typeof item === "string") &&
    typeof candidate.overallScore === "number"
  )
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: AuditBody
  try {
    body = (await req.json()) as AuditBody
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const page = typeof body.page === "string" ? body.page : ""
  const keywords = Array.isArray(body.keywords)
    ? body.keywords.filter((keyword): keyword is string => typeof keyword === "string")
    : null

  if (!page || !Array.isArray(body.keywords) || keywords === null) {
    return NextResponse.json({ error: "page and keywords are required" }, { status: 400 })
  }

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      payloadUrl: true,
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
    select: { stripePriceId: true },
  })

  const scanLimit = getScanLimit(subscription?.stripePriceId)
  const keywordLimit = getKeywordLimit(subscription?.stripePriceId)

  if (keywords.length > keywordLimit) {
    return NextResponse.json(
      { error: `Your plan supports up to ${keywordLimit} keywords per audit.` },
      { status: 400 }
    )
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const scansUsedThisMonth = await prisma.seoScan.count({
    where: {
      userId: session.user.id,
      createdAt: { gte: startOfMonth },
    },
  })

  if (scanLimit !== null && scansUsedThisMonth >= scanLimit) {
    return NextResponse.json(
      { error: "Monthly scan limit reached. Upgrade to run more audits." },
      { status: 429 }
    )
  }

  if (!site.payloadUrl) {
    return NextResponse.json({ error: "Payload fetch failed" }, { status: 502 })
  }

  let pageDoc: Record<string, unknown> | undefined

  try {
    const pageResponse = await fetch(
      `${site.payloadUrl}/api/pages?where[slug][equals]=${encodeURIComponent(page)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }
    )

    if (!pageResponse.ok) {
      return NextResponse.json({ error: "Payload fetch failed" }, { status: 502 })
    }

    const pageData = (await pageResponse.json()) as PayloadPageResponse
    pageDoc = pageData.docs?.[0]
  } catch {
    return NextResponse.json({ error: "Payload fetch failed" }, { status: 502 })
  }

  if (!pageDoc) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 })
  }

  const metaTitle = getNestedValue(pageDoc, ["meta", "title"])
  const metaDescription = getNestedValue(pageDoc, ["meta", "description"])
  const ogTitle = getNestedValue(pageDoc, ["openGraph", "title"])
  const ogDescription = getNestedValue(pageDoc, ["openGraph", "description"])

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

  const userPrompt = `Page: ${page}
Meta Title: ${metaTitle ?? "(not set)"}
Meta Description: ${metaDescription ?? "(not set)"}
OG Title: ${ogTitle ?? "(not set)"}
OG Description: ${ogDescription ?? "(not set)"}
Target Keywords: ${keywords.join(", ")}

Analyse each SEO field for length, keyword presence, and best practices.
Score each 0-100. Return JSON only.`

  let audit: AuditResult

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1000,
      stream: false,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    })

    const text = ("content" in message ? message.content : [])
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n")
      .trim()
    const parsed = JSON.parse(text) as unknown

    if (!isAuditResult(parsed)) {
      return NextResponse.json({ error: "Invalid JSON returned from audit model." }, { status: 500 })
    }

    audit = parsed
  } catch {
    return NextResponse.json({ error: "Invalid JSON returned from audit model." }, { status: 500 })
  }

  await prisma.seoScan.create({
    data: {
      userId: session.user.id,
      siteId: site.id,
      page,
    },
  })

  const scansUsed = scansUsedThisMonth + 1
  const scansRemaining = scanLimit === null ? null : Math.max(scanLimit - scansUsed, 0)

  return NextResponse.json({
    scores: audit.scores,
    recommendations: audit.recommendations,
    overallScore: audit.overallScore,
    scansRemaining,
  })
}
