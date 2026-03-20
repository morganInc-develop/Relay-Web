import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import {
  VALID_SECTION_TYPES,
  VALID_VARIANT_IDS,
  getVariantById,
} from "@/lib/component-variants"
import { hasDesignAccess } from "@/lib/design-tier"
import { prisma } from "@/lib/prisma"
import { layoutRateLimit } from "@/lib/rate-limit"
import { triggerRebuild } from "@/lib/rebuild"

interface SwapComponentBody {
  key?: string
  value?: string
}

const componentVariantKeyRegex = /^component-variant:[a-z]+$/

export async function PATCH(req: NextRequest) {
  // 1. Auth
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Parse body
  let body: SwapComponentBody
  try {
    body = (await req.json()) as SwapComponentBody
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { key, value } = body

  // 3. Validate key
  const sectionType = key?.split(":")[1]
  if (!key || !componentVariantKeyRegex.test(key) || !sectionType || !VALID_SECTION_TYPES.has(sectionType)) {
    return NextResponse.json({ error: "Invalid section type" }, { status: 400 })
  }

  // 4. Validate value
  if (typeof value !== "string" || !VALID_VARIANT_IDS.has(value)) {
    return NextResponse.json({ error: "Invalid variant ID" }, { status: 400 })
  }

  const variant = getVariantById(value)
  if (!variant || variant.sectionType !== sectionType) {
    return NextResponse.json({ error: "Variant does not match section type" }, { status: 400 })
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
