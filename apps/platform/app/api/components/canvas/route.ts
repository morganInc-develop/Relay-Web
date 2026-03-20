import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import type { CanvasItem } from "@/lib/canvas-registry"
import { auth } from "@/lib/auth"
import { getValidPropKeys, VALID_CANVAS_TYPES } from "@/lib/canvas-registry"
import { hasTier3Access } from "@/lib/design-tier"
import { prisma } from "@/lib/prisma"
import { canvasRateLimit } from "@/lib/rate-limit"

interface PatchCanvasBody {
  pageSlug?: string
  layout?: unknown
}

const PAGE_SLUG_REGEX = /^[a-z0-9][a-z0-9-]*$/

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  )
}

function validateCanvasLayout(layout: unknown): CanvasItem[] | { error: string } {
  if (!Array.isArray(layout)) {
    return { error: "Layout must be an array" }
  }

  if (layout.length > 30) {
    return { error: "Canvas cannot exceed 30 components" }
  }

  const validatedLayout: CanvasItem[] = []

  for (const item of layout) {
    if (!isPlainObject(item)) {
      return { error: "Invalid canvas item" }
    }

    const id = item.id
    const componentType = item.componentType
    const props = item.props

    if (
      typeof id !== "string" ||
      !id ||
      typeof componentType !== "string" ||
      !VALID_CANVAS_TYPES.has(componentType) ||
      !isPlainObject(props)
    ) {
      return { error: "Invalid canvas item" }
    }

    const validPropKeys = getValidPropKeys(componentType)
    const validatedProps: Record<string, string> = {}

    for (const [key, value] of Object.entries(props)) {
      if (!validPropKeys.has(key) || typeof value !== "string") {
        return { error: "Invalid canvas item" }
      }

      validatedProps[key] = value
    }

    validatedLayout.push({
      id,
      componentType,
      props: validatedProps,
    })
  }

  return validatedLayout
}

export async function GET(req: NextRequest) {
  // 1. Auth
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Validate pageSlug
  const pageSlug = req.nextUrl.searchParams.get("pageSlug") ?? ""
  if (!PAGE_SLUG_REGEX.test(pageSlug)) {
    return NextResponse.json({ error: "Invalid page slug" }, { status: 400 })
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

  // 4. No tier gate on GET — all tiers can read

  // 5. Fetch
  const record = await prisma.canvasLayout.findUnique({
    where: { siteId_pageSlug: { siteId: site.id, pageSlug } },
  })

  // 6. Return
  return NextResponse.json({ layout: Array.isArray(record?.layout) ? record.layout : [] })
}

export async function PATCH(req: NextRequest) {
  // 1. Auth
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Parse body
  let body: PatchCanvasBody
  try {
    body = (await req.json()) as PatchCanvasBody
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // 3. Validate pageSlug
  const pageSlug = typeof body.pageSlug === "string" ? body.pageSlug : ""
  if (!PAGE_SLUG_REGEX.test(pageSlug)) {
    return NextResponse.json({ error: "Invalid page slug" }, { status: 400 })
  }

  // 4. Validate layout
  const validatedLayout = validateCanvasLayout(body.layout)
  if (!Array.isArray(validatedLayout)) {
    return NextResponse.json({ error: validatedLayout.error }, { status: 400 })
  }

  // 5. Site lookup
  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 })
  }

  // 6. Subscription lookup
  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { stripePriceId: true },
  })

  // 7. Tier gate
  if (!hasTier3Access(subscription?.stripePriceId)) {
    return NextResponse.json({ error: "Canvas requires Tier 3" }, { status: 403 })
  }

  // 8. Rate limit
  const rateLimitResult = await canvasRateLimit.limit(`relayweb:canvas:${session.user.id}`)
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  // 9. Upsert
  await prisma.canvasLayout.upsert({
    where: { siteId_pageSlug: { siteId: site.id, pageSlug } },
    update: { layout: validatedLayout as unknown as Prisma.InputJsonValue },
    create: {
      siteId: site.id,
      pageSlug,
      layout: validatedLayout as unknown as Prisma.InputJsonValue,
    },
  })

  // 10. Return
  return NextResponse.json({ success: true, pageSlug, itemCount: validatedLayout.length })
}
