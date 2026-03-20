import { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { hasTier3Access } from "@/lib/design-tier"
import { prisma } from "@/lib/prisma"
import { structuredDataRateLimit } from "@/lib/rate-limit"
import { triggerRebuild } from "@/lib/rebuild"

interface StructuredDataBody {
  pageSlug?: string
  schema?: unknown
}

const PAGE_SLUG_REGEX = /^[a-z0-9-]+$/

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export async function GET(req: NextRequest) {
  // 1. Auth
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. pageSlug from query
  const pageSlug = req.nextUrl.searchParams.get("pageSlug")?.trim() ?? ""
  if (!pageSlug) {
    return NextResponse.json({ error: "Page slug is required" }, { status: 400 })
  }

  // 3. Site lookup
  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 })
  }

  // 4. Subscription lookup
  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { stripePriceId: true },
  })

  // 5. Tier gate
  if (!hasTier3Access(subscription?.stripePriceId)) {
    return NextResponse.json({ error: "Structured data requires Tier 3" }, { status: 403 })
  }

  // 6. Fetch record
  const record = await prisma.structuredData.findUnique({
    where: {
      siteId_pageSlug: {
        siteId: site.id,
        pageSlug,
      },
    },
  })

  // 7. Return
  return NextResponse.json({ schema: record?.schema ?? null })
}

export async function PATCH(req: NextRequest) {
  // 1. Auth
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Parse body
  let body: StructuredDataBody
  try {
    body = (await req.json()) as StructuredDataBody
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // 3. Validate pageSlug
  const pageSlug = typeof body.pageSlug === "string" ? body.pageSlug.trim() : ""
  if (!pageSlug || !PAGE_SLUG_REGEX.test(pageSlug)) {
    return NextResponse.json({ error: "Invalid page slug" }, { status: 400 })
  }

  // 4. Validate schema shape
  if (!isPlainObject(body.schema)) {
    return NextResponse.json({ error: "Schema must be a JSON object" }, { status: 400 })
  }

  const schema = body.schema
  const schemaInput = body.schema as Prisma.InputJsonValue

  // 5. Validate @context
  if (schema["@context"] !== "https://schema.org") {
    return NextResponse.json(
      { error: 'Schema must include @context: "https://schema.org"' },
      { status: 400 }
    )
  }

  // 6. Validate @type
  if (typeof schema["@type"] !== "string" || schema["@type"].trim().length === 0) {
    return NextResponse.json(
      { error: "Schema must include a non-empty @type" },
      { status: 400 }
    )
  }

  // 7. Site lookup
  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, repoUrl: true },
  })

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 })
  }

  // 8. Subscription lookup
  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { stripePriceId: true },
  })

  // 9. Tier gate
  if (!hasTier3Access(subscription?.stripePriceId)) {
    return NextResponse.json({ error: "Structured data requires Tier 3" }, { status: 403 })
  }

  // 10. Rate limit
  const rateLimitResult = await structuredDataRateLimit.limit(
    `relayweb:structured-data:${session.user.id}`
  )
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  // 11. Upsert
  await prisma.structuredData.upsert({
    where: {
      siteId_pageSlug: {
        siteId: site.id,
        pageSlug,
      },
    },
    update: { schema: schemaInput },
    create: {
      siteId: site.id,
      pageSlug,
      schema: schemaInput,
    },
  })

  // 12. Trigger rebuild
  await triggerRebuild(site.repoUrl + "/dispatches", { source: "structured-data", pageSlug })

  // 13. Return
  return NextResponse.json({ success: true, pageSlug })
}
