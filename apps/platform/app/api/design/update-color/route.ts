import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { hasDesignAccess } from "@/lib/design-tier"
import { prisma } from "@/lib/prisma"
import { designRateLimit } from "@/lib/rate-limit"
import { triggerRebuild } from "@/lib/rebuild"

interface UpdateColorBody {
  key?: string
  value?: string
  type?: "solid" | "gradient"
}

const keyRegex = /^[a-z][a-z0-9-]*$/
const hexColorRegex = /^#[0-9a-fA-F]{6}$/

export async function PATCH(req: NextRequest) {
  // 1. Auth check
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Parse and validate request body
  let body: UpdateColorBody
  try {
    body = (await req.json()) as UpdateColorBody
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { key, value, type } = body
  if (!key || typeof value !== "string" || value.length === 0 || !keyRegex.test(key)) {
    return NextResponse.json({ error: "Invalid key or value" }, { status: 400 })
  }

  // 3. Validate color value by type
  const isValidSolid = type === "solid" && hexColorRegex.test(value)
  const isValidGradient =
    type === "gradient" &&
    (value.startsWith("linear-gradient(") || value.startsWith("radial-gradient(")) &&
    value.length < 200

  if (!isValidSolid && !isValidGradient) {
    return NextResponse.json({ error: "Invalid color value" }, { status: 400 })
  }

  // 4. Look up site ownership
  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, repoUrl: true },
  })

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 })
  }

  // 5. Look up subscription
  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { stripePriceId: true },
  })

  // 6. Tier gate
  if (!hasDesignAccess(subscription?.stripePriceId)) {
    return NextResponse.json({ error: "Design controls require Tier 2 or higher" }, { status: 403 })
  }

  // 7. Rate limit
  const rateLimitResult = await designRateLimit.limit(`relayweb:design:${session.user.id}`)
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  // 8. Upsert token
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

  // 9. Trigger rebuild
  await triggerRebuild(site.repoUrl + "/dispatches", { source: "design", key })

  // 10. Return success
  return NextResponse.json({ success: true, key, value })
}
