import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { hasTier3Access } from "@/lib/design-tier"
import { prisma } from "@/lib/prisma"
import { siteRateLimit } from "@/lib/rate-limit"

interface CreateScriptBody {
  name?: string
  src?: string
  content?: string
  placement?: string
}

const SCRIPT_SRC_REGEX = /^https:\/\/.+\..+/

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

  // 3. No tier gate — any tier can read

  // 4. Return
  return NextResponse.json({
    scripts: await prisma.scriptInjection.findMany({
      where: { siteId: site.id },
      orderBy: { createdAt: "desc" },
    }),
  })
}

export async function POST(req: NextRequest) {
  // 1. Auth
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Parse body
  let body: CreateScriptBody
  try {
    body = (await req.json()) as CreateScriptBody
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // 3. Validate name
  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (name.length < 1 || name.length > 100) {
    return NextResponse.json({ error: "Name is required (1–100 chars)" }, { status: 400 })
  }

  // 4. Validate placement
  const placement = body.placement
  if (placement !== "head" && placement !== "body") {
    return NextResponse.json({ error: "Placement must be 'head' or 'body'" }, { status: 400 })
  }

  // 5. Validate src / content mutual exclusivity
  const src = typeof body.src === "string" ? body.src.trim() : ""
  const content = typeof body.content === "string" ? body.content.trim() : ""
  const hasSrc = src.length > 0
  const hasContent = content.length > 0

  if (hasSrc === hasContent) {
    return NextResponse.json(
      { error: "Provide either src or content, not both" },
      { status: 400 }
    )
  }

  if (hasSrc && !SCRIPT_SRC_REGEX.test(src)) {
    return NextResponse.json(
      { error: "Script src must be a valid HTTPS URL" },
      { status: 400 }
    )
  }

  if (hasContent && (content.length < 1 || content.length > 5000)) {
    return NextResponse.json(
      { error: "Script content must be 1–5000 characters" },
      { status: 400 }
    )
  }

  // 6. Site lookup
  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
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
    return NextResponse.json(
      { error: "Script injection requires Tier 3" },
      { status: 403 }
    )
  }

  // 9. Script count check
  const scriptCount = await prisma.scriptInjection.count({
    where: { siteId: site.id },
  })
  if (scriptCount >= 10) {
    return NextResponse.json({ error: "Maximum 10 scripts per site" }, { status: 400 })
  }

  // 10. Rate limit
  const rateLimitResult = await siteRateLimit.limit(`relayweb:site:${session.user.id}`)
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  // 11. Create
  const created = await prisma.scriptInjection.create({
    data: {
      siteId: site.id,
      name,
      src: hasSrc ? src : null,
      content: hasContent ? content : null,
      placement,
    },
  })

  // 12. Return
  return NextResponse.json({ script: created }, { status: 201 })
}
