import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { hasTier3Access } from "@/lib/design-tier"
import { prisma } from "@/lib/prisma"
import { sitemapRateLimit } from "@/lib/rate-limit"
import { triggerRebuild } from "@/lib/rebuild"

interface SitemapPatchBody {
  entries?: unknown
}

interface ValidatedSitemapEntry {
  pageSlug: string
  include: boolean
  priority: number
  changefreq: string
}

const PAGE_SLUG_REGEX = /^[a-z0-9-]+$/
const VALID_CHANGEFREQ = new Set([
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never",
])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export async function GET() {
  // 1. Auth
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Site lookup
  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 })
  }

  // 3. Subscription lookup
  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { stripePriceId: true },
  })

  // 4. Tier gate
  if (!hasTier3Access(subscription?.stripePriceId)) {
    return NextResponse.json({ error: "Sitemap management requires Tier 3" }, { status: 403 })
  }

  // 5. Fetch records
  const records = await prisma.sitemapEntry.findMany({
    where: { siteId: site.id },
    orderBy: { pageSlug: "asc" },
  })

  // 6. Return
  return NextResponse.json({ entries: records })
}

export async function PATCH(req: NextRequest) {
  // 1. Auth
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Parse body
  let body: SitemapPatchBody
  try {
    body = (await req.json()) as SitemapPatchBody
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // 3. Validate entries array
  if (!Array.isArray(body.entries)) {
    return NextResponse.json({ error: "Entries must be an array" }, { status: 400 })
  }

  // 4. Validate max 100 entries
  if (body.entries.length > 100) {
    return NextResponse.json({ error: "Entries cannot exceed 100 items" }, { status: 400 })
  }

  const validatedEntries: ValidatedSitemapEntry[] = []

  // 5. Validate each entry
  for (const [index, entry] of body.entries.entries()) {
    if (!isPlainObject(entry)) {
      return NextResponse.json({ error: `Invalid entry at index ${index}` }, { status: 400 })
    }

    const pageSlug = typeof entry.pageSlug === "string" ? entry.pageSlug.trim() : ""
    const include = entry.include
    const priority = entry.priority
    const changefreq = entry.changefreq

    if (
      !pageSlug ||
      !PAGE_SLUG_REGEX.test(pageSlug) ||
      typeof include !== "boolean" ||
      typeof priority !== "number" ||
      Number.isNaN(priority) ||
      priority < 0 ||
      priority > 1 ||
      typeof changefreq !== "string" ||
      !VALID_CHANGEFREQ.has(changefreq)
    ) {
      return NextResponse.json({ error: `Invalid entry at index ${index}` }, { status: 400 })
    }

    validatedEntries.push({
      pageSlug,
      include,
      priority,
      changefreq,
    })
  }

  // 6. Site lookup
  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, repoUrl: true },
  })

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 })
  }

  // 7. Subscription lookup
  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { stripePriceId: true },
  })

  // 8. Tier gate
  if (!hasTier3Access(subscription?.stripePriceId)) {
    return NextResponse.json({ error: "Sitemap management requires Tier 3" }, { status: 403 })
  }

  // 9. Rate limit
  const rateLimitResult = await sitemapRateLimit.limit(`relayweb:sitemap:${session.user.id}`)
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  // 10. Bulk upsert
  await prisma.$transaction(
    validatedEntries.map((entry) =>
      prisma.sitemapEntry.upsert({
        where: {
          siteId_pageSlug: {
            siteId: site.id,
            pageSlug: entry.pageSlug,
          },
        },
        update: {
          include: entry.include,
          priority: entry.priority,
          changefreq: entry.changefreq,
        },
        create: {
          siteId: site.id,
          pageSlug: entry.pageSlug,
          include: entry.include,
          priority: entry.priority,
          changefreq: entry.changefreq,
        },
      })
    )
  )

  // 11. Trigger rebuild
  await triggerRebuild(site.repoUrl + "/dispatches", { source: "sitemap" })

  // 12. Return
  return NextResponse.json({ success: true, count: validatedEntries.length })
}
