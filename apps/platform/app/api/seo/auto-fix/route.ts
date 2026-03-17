import { auth } from "@/lib/auth"
import {
  applySeoFieldUpdate,
  ContentMutationError,
  SeoField,
} from "@/lib/content-mutations"
import { getPageFromPayload } from "@/lib/payload-client"
import { prisma } from "@/lib/prisma"
import { getUserSubscription, tierNotAllowedResponse } from "@/lib/site-access"
import Anthropic from "@anthropic-ai/sdk"
import { SubscriptionStatus, SubscriptionTier } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface AutoFixBody {
  page: string
  recommendations: string[]
  currentFields?: Partial<Record<SeoField, string>>
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".")
  let value: unknown = obj

  for (const key of keys) {
    if (!value || typeof value !== "object") return undefined
    value = (value as Record<string, unknown>)[key]
  }

  return value
}

function sanitizeJsonBlock(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()
}

function toGeneratedFields(input: unknown): Partial<Record<SeoField, string>> {
  if (!input || typeof input !== "object") return {}
  const raw = input as Record<string, unknown>
  const fields: SeoField[] = ["metaTitle", "metaDescription", "ogTitle", "ogDescription", "ogImage"]
  const output: Partial<Record<SeoField, string>> = {}

  for (const field of fields) {
    const value = raw[field]
    if (typeof value === "string") output[field] = value
  }

  return output
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: AutoFixBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { page, recommendations, currentFields } = body
  if (!page || !Array.isArray(recommendations)) {
    return NextResponse.json(
      { error: "page and recommendations are required" },
      { status: 400 }
    )
  }

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
  })

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 })
  }

  if (!site.domainVerified || !site.linked) {
    return NextResponse.json({ error: "Site must be verified and linked first" }, { status: 403 })
  }

  const subscription = await getUserSubscription(session.user.id)
  if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
    return NextResponse.json({ error: "Active subscription required" }, { status: 403 })
  }
  if (subscription.tier === SubscriptionTier.TIER1) {
    return tierNotAllowedResponse("AI SEO auto-fix")
  }

  const { data: pageData, error: pageError, status: pageStatus } = await getPageFromPayload(site, page)
  if (pageError) {
    return NextResponse.json({ error: pageError }, { status: pageStatus })
  }

  const pageDoc = (pageData as { docs?: Array<Record<string, unknown>> } | null)?.docs?.[0]
  if (!pageDoc || typeof pageDoc.id !== "string") {
    return NextResponse.json({ error: "Page not found" }, { status: 404 })
  }

  const payloadFields: Record<SeoField, string> = {
    metaTitle: String(getNestedValue(pageDoc, "meta.title") ?? ""),
    metaDescription: String(getNestedValue(pageDoc, "meta.description") ?? ""),
    ogTitle: String(getNestedValue(pageDoc, "meta.ogTitle") ?? ""),
    ogDescription: String(getNestedValue(pageDoc, "meta.ogDescription") ?? ""),
    ogImage: String(getNestedValue(pageDoc, "meta.ogImage") ?? ""),
  }

  const baseline: Record<SeoField, string> = {
    ...payloadFields,
    ...(currentFields ?? {}),
  }

  const prompt = `You improve SEO fields for a page.
Return ONLY valid JSON with these optional string fields:
{
  "metaTitle": "string",
  "metaDescription": "string",
  "ogTitle": "string",
  "ogDescription": "string",
  "ogImage": "string"
}

Page: ${page}
Current fields:
${JSON.stringify(baseline, null, 2)}

Recommendations:
${JSON.stringify(recommendations, null, 2)}`

  let improved: Partial<Record<SeoField, string>>
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    })

    const textBlock = response.content.find((block) => block.type === "text")
    const text = textBlock && textBlock.type === "text" ? textBlock.text : ""
    improved = toGeneratedFields(JSON.parse(sanitizeJsonBlock(text)))
  } catch {
    return NextResponse.json({ error: "Failed to generate SEO fixes" }, { status: 502 })
  }

  const fixed: string[] = []
  const skipped: string[] = []
  const fields: SeoField[] = ["metaTitle", "metaDescription", "ogTitle", "ogDescription", "ogImage"]

  for (const field of fields) {
    const generatedValue = improved[field]?.trim()
    if (!generatedValue) {
      skipped.push(field)
      continue
    }
    if (generatedValue === baseline[field].trim()) {
      skipped.push(field)
      continue
    }

    try {
      await applySeoFieldUpdate({
        site,
        page,
        field,
        value: generatedValue,
        userId: session.user.id,
        subscriptionTier: subscription.tier,
      })
      fixed.push(field)
    } catch (error) {
      if (error instanceof ContentMutationError) {
        console.error(`[SEO Auto-Fix] Failed for ${field}:`, error.message)
      } else {
        console.error(`[SEO Auto-Fix] Failed for ${field}:`, error)
      }
      skipped.push(field)
    }
  }

  return NextResponse.json({ fixed, skipped })
}
