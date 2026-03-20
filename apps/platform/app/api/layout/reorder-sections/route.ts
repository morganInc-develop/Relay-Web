import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { VALID_SECTION_TYPES } from "@/lib/component-variants"
import { hasDesignAccess } from "@/lib/design-tier"
import { prisma } from "@/lib/prisma"
import { layoutRateLimit } from "@/lib/rate-limit"
import { triggerRebuild } from "@/lib/rebuild"

interface ReorderSectionsBody {
  key?: string
  value?: string
}

export async function PATCH(req: NextRequest) {
  // 1. Auth
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Parse body
  let body: ReorderSectionsBody
  try {
    body = (await req.json()) as ReorderSectionsBody
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { key, value } = body

  // 3. Validate key
  if (key !== "section-order") {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 })
  }

  // 4. Validate value
  if (typeof value !== "string") {
    return NextResponse.json({ error: "Invalid section order" }, { status: 400 })
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) {
      throw new Error("Section order must be an array")
    }

    if (!parsed.every((item) => typeof item === "string" && VALID_SECTION_TYPES.has(item))) {
      throw new Error("Section order contains invalid section types")
    }

    if (new Set(parsed).size !== parsed.length) {
      throw new Error("Section order contains duplicates")
    }

    if (parsed.length !== VALID_SECTION_TYPES.size) {
      throw new Error("Section order is incomplete")
    }
  } catch {
    return NextResponse.json({ error: "Invalid section order" }, { status: 400 })
  }

  // 5. Site lookup
  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, repoUrl: true },
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
  if (!hasDesignAccess(subscription?.stripePriceId)) {
    return NextResponse.json({ error: "Design controls require Tier 2 or higher" }, { status: 403 })
  }

  // 8. Rate limit
  const rateLimitResult = await layoutRateLimit.limit(`relayweb:layout:${session.user.id}`)
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  // 9. Upsert
  await prisma.designToken.upsert({
    where: {
      siteId_key: {
        siteId: site.id,
        key,
      },
    },
    update: { value },
    create: {
      siteId: site.id,
      key,
      value,
    },
  })

  // 10. Rebuild
  await triggerRebuild(site.repoUrl + "/dispatches", { source: "layout", key })

  // 11. Return
  return NextResponse.json({ success: true, key, value })
}
