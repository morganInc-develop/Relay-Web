import { auth } from "@/lib/auth"
import { applySeoFieldUpdate } from "@/lib/content-mutations"
import { prisma } from "@/lib/prisma"
import { getScanLimit } from "@/lib/seo-limits"
import Anthropic from "@anthropic-ai/sdk"
import { NextRequest, NextResponse } from "next/server"

type SeoField = "metaTitle" | "metaDescription" | "ogTitle" | "ogDescription" | "ogImage"

interface AutoFixBody {
  page?: string
  recommendations?: unknown
  currentFields?: unknown
}

interface PayloadPageResponse {
  docs?: Array<Record<string, unknown>>
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const seoFields: SeoField[] = [
  "metaTitle",
  "metaDescription",
  "ogTitle",
  "ogDescription",
  "ogImage",
]

function getNestedValue(value: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = value

  for (const segment of path) {
    if (!current || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[segment]
  }

  return current
}

function sanitizeJson(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()
}

function toCurrentFields(value: unknown): Record<SeoField, string> | null {
  if (!value || typeof value !== "object") return null

  const fields = value as Record<string, unknown>
  const current: Record<SeoField, string> = {
    metaTitle: "",
    metaDescription: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
  }

  for (const field of seoFields) {
    const next = fields[field]
    if (typeof next === "string") {
      current[field] = next
    }
  }

  return current
}

function toGeneratedFields(value: unknown): Partial<Record<SeoField, string>> {
  if (!value || typeof value !== "object") return {}

  const raw = value as Record<string, unknown>
  const generated: Partial<Record<SeoField, string>> = {}

  for (const field of seoFields) {
    const next = raw[field]
    if (typeof next === "string") {
      generated[field] = next
    }
  }

  return generated
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: AutoFixBody
  try {
    body = (await req.json()) as AutoFixBody
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const page = typeof body.page === "string" ? body.page : ""
  const recommendations = Array.isArray(body.recommendations)
    ? body.recommendations.filter((item): item is string => typeof item === "string")
    : null
  const currentFields = toCurrentFields(body.currentFields)

  if (!page || !Array.isArray(body.recommendations) || currentFields === null) {
    return NextResponse.json(
      { error: "page, recommendations, and currentFields are required" },
      { status: 400 }
    )
  }

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      payloadUrl: true,
      repoUrl: true,
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

  const scanLimit = getScanLimit(subscription.stripePriceId)
  const isStarterByPrice = subscription.stripePriceId === process.env.STRIPE_PRICE_STARTER
  const isStarterFallback = scanLimit === 5

  if (isStarterByPrice || isStarterFallback) {
    return NextResponse.json(
      { error: "Auto-fix is available on Growth and Pro plans." },
      { status: 403 }
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

  if (!pageDoc || typeof pageDoc.id !== "string") {
    return NextResponse.json({ error: "Page not found" }, { status: 404 })
  }

  const currentPayloadFields: Record<SeoField, string> = {
    metaTitle: String(getNestedValue(pageDoc, ["meta", "title"]) ?? ""),
    metaDescription: String(getNestedValue(pageDoc, ["meta", "description"]) ?? ""),
    ogTitle: String(getNestedValue(pageDoc, ["openGraph", "title"]) ?? ""),
    ogDescription: String(getNestedValue(pageDoc, ["openGraph", "description"]) ?? ""),
    ogImage: String(getNestedValue(pageDoc, ["openGraph", "url"]) ?? ""),
  }

  const prompt = `You are an SEO assistant.
Given these recommendations and current field values, generate improved SEO fields.
Return ONLY valid JSON in this format:
{
  "metaTitle": "string",
  "metaDescription": "string",
  "ogTitle": "string",
  "ogDescription": "string",
  "ogImage": "string"
}
Only include fields that should be improved.

Page: ${page}
Recommendations:
${JSON.stringify(recommendations, null, 2)}

Current fields:
${JSON.stringify({ ...currentPayloadFields, ...currentFields }, null, 2)}`

  let generated: Partial<Record<SeoField, string>>

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1000,
      stream: false,
      messages: [{ role: "user", content: prompt }],
    })

    const text = ("content" in message ? message.content : [])
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n")
      .trim()
    generated = toGeneratedFields(JSON.parse(sanitizeJson(text)))
  } catch {
    return NextResponse.json({ error: "Failed to generate SEO fixes" }, { status: 500 })
  }

  const fixed: string[] = []
  const skipped: string[] = []

  for (const field of seoFields) {
    const nextValue = generated[field]?.trim()

    if (!nextValue) {
      skipped.push(field)
      continue
    }

    try {
      await applySeoFieldUpdate({
        site,
        page,
        field,
        value: nextValue,
        stripePriceId: subscription.stripePriceId,
      })
      currentPayloadFields[field] = nextValue
      fixed.push(field)
    } catch {
      skipped.push(field)
    }
  }

  return NextResponse.json({ fixed, skipped })
}
