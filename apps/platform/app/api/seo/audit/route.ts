import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import {
  getSiteForUser,
  getUserSubscription,
  tierAllows,
  tierNotAllowedResponse,
} from "@/lib/site-access"
import { getPageFromPayload } from "@/lib/payload-client"
import { checkRateLimit, rateLimiters } from "@/lib/rate-limit"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"
import { Prisma, SubscriptionStatus, SubscriptionTier } from "@prisma/client"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface SeoAuditBody {
  siteId: string
  pageSlug: string
  keywords: string[]
}

interface PayloadPageData {
  meta?: {
    title?: string
    description?: string
  }
  hero?: {
    heading?: string
    subheading?: string
  }
}

interface PayloadPageDocsResponse {
  docs?: PayloadPageData[]
}

type AuditStatus = "pass" | "warning" | "fail"

interface AuditCheck {
  score: number
  status: AuditStatus
  recommendation: string
}

interface AuditResults {
  overallScore: number
  checks: {
    titleTag: AuditCheck
    metaDescription: AuditCheck
    headingStructure: AuditCheck
    keywordDensity: AuditCheck
    ogImage: AuditCheck
  }
  topRecommendation: string
}

function isAuditStatus(value: unknown): value is AuditStatus {
  return value === "pass" || value === "warning" || value === "fail"
}

function isAuditCheck(value: unknown): value is AuditCheck {
  if (!value || typeof value !== "object") return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.score === "number" &&
    isAuditStatus(candidate.status) &&
    typeof candidate.recommendation === "string"
  )
}

function isAuditResults(value: unknown): value is AuditResults {
  if (!value || typeof value !== "object") return false
  const candidate = value as Record<string, unknown>
  if (typeof candidate.overallScore !== "number") return false
  if (!candidate.checks || typeof candidate.checks !== "object") return false
  if (typeof candidate.topRecommendation !== "string") return false

  const checks = candidate.checks as Record<string, unknown>
  return (
    isAuditCheck(checks.titleTag) &&
    isAuditCheck(checks.metaDescription) &&
    isAuditCheck(checks.headingStructure) &&
    isAuditCheck(checks.keywordDensity) &&
    isAuditCheck(checks.ogImage)
  )
}

// Tier limits
const SEO_AUDIT_LIMITS = {
  TIER1: { auditsPerMonth: 5, keywordsPerPage: 3 },
  TIER2: { auditsPerMonth: 20, keywordsPerPage: 10 },
  TIER3: { auditsPerMonth: Infinity, keywordsPerPage: Infinity },
}

export async function POST(req: NextRequest) {
  // 1. Auth check
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const seoRateLimit = await checkRateLimit(rateLimiters.seoAudit, session.user.id)
  if (!seoRateLimit.success) return seoRateLimit.response!

  // Parse body
  let body: SeoAuditBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { siteId, pageSlug, keywords } = body
  if (!siteId || !pageSlug || !keywords?.length) {
    return NextResponse.json({ error: "siteId, pageSlug, and keywords are required" }, { status: 400 })
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
    return tierNotAllowedResponse("SEO audit")
  }

  // 4. Rate limit check
  const aiLimiter = subscription.tier === SubscriptionTier.TIER1
    ? rateLimiters.aiTier1
    : subscription.tier === SubscriptionTier.TIER2
    ? rateLimiters.aiTier2
    : null

  if (aiLimiter) {
    const rateLimit = await checkRateLimit(aiLimiter, session.user.id)
    if (!rateLimit.success) return rateLimit.response!
  }

  const limits = SEO_AUDIT_LIMITS[subscription.tier]

  // Enforce keyword limit per tier
  if (keywords.length > limits.keywordsPerPage) {
    return NextResponse.json(
      {
        error: `Your plan allows ${limits.keywordsPerPage} keyword${limits.keywordsPerPage === 1 ? "" : "s"} per audit. Upgrade to track more.`,
        upgradeRequired: true,
      },
      { status: 403 }
    )
  }

  // Enforce monthly audit limit
  if (limits.auditsPerMonth !== Infinity) {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const auditCount = await prisma.sEOAudit.count({
      where: {
        siteId,
        createdAt: { gte: startOfMonth },
      },
    })

    if (auditCount >= limits.auditsPerMonth) {
      return NextResponse.json(
        {
          error: `You have used all ${limits.auditsPerMonth} SEO audits for this month. Resets on the 1st.`,
          upgradeRequired: true,
        },
        { status: 429 }
      )
    }
  }

  // Fetch page content from Payload
  const { data: pageData, error: pageError } = await getPageFromPayload(site, pageSlug)
  if (pageError || !pageData) {
    return NextResponse.json({ error: pageError ?? "Page not found" }, { status: 404 })
  }

  const page = (pageData as PayloadPageDocsResponse).docs?.[0]
  if (!page) {
    return NextResponse.json({ error: "Page not found in Payload" }, { status: 404 })
  }

  // Run AI SEO audit via Claude Haiku
  const auditPrompt = `You are an expert SEO auditor. Analyze the following page content and provide a detailed SEO audit.

Page slug: ${pageSlug}
Target keywords: ${keywords.join(", ")}

Page data:
- Meta title: ${page.meta?.title ?? "Not set"}
- Meta description: ${page.meta?.description ?? "Not set"}
- Hero heading: ${page.hero?.heading ?? "Not set"}
- Hero subheading: ${page.hero?.subheading ?? "Not set"}

Analyze and score each of the following checks from 0 to 100:
1. Title tag optimization (keyword placement, length 50-60 chars)
2. Meta description quality (keyword usage, length 150-160 chars, call to action)
3. Heading structure (H1 presence, keyword in heading)
4. Keyword density in visible content
5. Open Graph image presence

For each check provide:
- score: number 0-100
- status: "pass" (80+), "warning" (50-79), or "fail" (0-49)
- recommendation: specific actionable fix if not passing

Respond ONLY with valid JSON in this exact format:
{
  "overallScore": number,
  "checks": {
    "titleTag": { "score": number, "status": "pass"|"warning"|"fail", "recommendation": "string" },
    "metaDescription": { "score": number, "status": "pass"|"warning"|"fail", "recommendation": "string" },
    "headingStructure": { "score": number, "status": "pass"|"warning"|"fail", "recommendation": "string" },
    "keywordDensity": { "score": number, "status": "pass"|"warning"|"fail", "recommendation": "string" },
    "ogImage": { "score": number, "status": "pass"|"warning"|"fail", "recommendation": "string" }
  },
  "topRecommendation": "string — the single most impactful fix"
}`

  let auditResults: AuditResults
  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1000,
      messages: [{ role: "user", content: auditPrompt }],
    })

    const responseText = message.content[0].type === "text" ? message.content[0].text : ""
    const cleanText = responseText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim()
    const parsed = JSON.parse(cleanText) as unknown
    if (!isAuditResults(parsed)) {
      return NextResponse.json({ error: "AI returned invalid audit format" }, { status: 502 })
    }
    auditResults = parsed
  } catch {
    return NextResponse.json({ error: "AI audit failed — please try again" }, { status: 500 })
  }

  // Save audit results to database
  const audit = await prisma.sEOAudit.create({
    data: {
      siteId,
      page: pageSlug,
      keywords,
      score: auditResults.overallScore,
      results: auditResults as unknown as Prisma.InputJsonValue,
    },
  })

  // Increment AI usage
  await prisma.aIUsage.upsert({
    where: { siteId },
    create: { siteId, chatRequests: 0, seoAudits: 1 },
    update: { seoAudits: { increment: 1 } },
  })

  await prisma.aIAuditLog.create({
    data: {
      siteId,
      actionType: "SEO_AUDIT",
      prompt: auditPrompt,
      routeCalled: "/api/seo/audit",
      success: true,
      afterValue: JSON.stringify(auditResults),
      errorMessage: null,
    },
  })

  return NextResponse.json({ success: true, auditId: audit.id, results: auditResults })
}
