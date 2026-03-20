import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { hasTier3Access } from "@/lib/design-tier"
import { prisma } from "@/lib/prisma"
import { siteRateLimit } from "@/lib/rate-limit"

interface WhitelabelBody {
  url?: string
}

const WHITELABEL_URL_REGEX = /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}/i

export async function PATCH(req: NextRequest) {
  // 1. Auth
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Parse body
  let body: WhitelabelBody
  try {
    body = (await req.json()) as WhitelabelBody
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // 3. Validate url
  if (typeof body.url !== "string") {
    return NextResponse.json(
      { error: "White-label URL must be a valid HTTPS URL" },
      { status: 400 }
    )
  }

  const url = body.url.trim()
  if (url.length > 200 || (url !== "" && !WHITELABEL_URL_REGEX.test(url))) {
    return NextResponse.json(
      { error: "White-label URL must be a valid HTTPS URL" },
      { status: 400 }
    )
  }

  // 4. Site lookup
  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 })
  }

  // 5. Subscription lookup
  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { stripePriceId: true },
  })

  // 6. Tier gate
  if (!hasTier3Access(subscription?.stripePriceId)) {
    return NextResponse.json(
      { error: "White-label URL requires Tier 3" },
      { status: 403 }
    )
  }

  // 7. Rate limit
  const rateLimitResult = await siteRateLimit.limit(`relayweb:site:${session.user.id}`)
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  // 8. Update
  const updated = await prisma.site.update({
    where: { id: site.id },
    data: { whitelabelUrl: url === "" ? null : url },
  })

  // 9. Return
  return NextResponse.json({
    success: true,
    whitelabelUrl: updated.whitelabelUrl ?? null,
  })
}
