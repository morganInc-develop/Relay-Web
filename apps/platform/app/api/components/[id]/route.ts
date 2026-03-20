import { NextResponse } from "next/server"

import { analyzeComponent } from "@/lib/acorn-analysis"
import { auth } from "@/lib/auth"
import { hasTier3Access } from "@/lib/design-tier"
import { prisma } from "@/lib/prisma"
import { componentRateLimit } from "@/lib/rate-limit"

interface PatchBody {
  code?: string
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id?: string }> }
) {
  // 1. Auth
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Extract id from params
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "Missing component ID" }, { status: 400 })
  }

  // 3. Parse body
  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // 4. Validate code
  const code = typeof body.code === "string" ? body.code : ""
  if (code.length < 1 || code.length > 10000) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 })
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
    return NextResponse.json({ error: "Component editing requires Tier 3" }, { status: 403 })
  }

  // 8. Rate limit
  const rateLimitResult = await componentRateLimit.limit(`relayweb:component:${session.user.id}`)
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  // 9. Ownership check
  const component = await prisma.component.findFirst({
    where: {
      id,
      library: {
        siteId: site.id,
      },
    },
  })

  if (!component) {
    return NextResponse.json({ error: "Component not found" }, { status: 404 })
  }

  // 10. Re-run Acorn analysis
  const analysis = analyzeComponent(code)

  // 11. Update
  const updatedComponent = await prisma.component.update({
    where: { id: component.id },
    data: {
      code,
      approved: analysis.approved,
    },
  })

  // 12. Return
  return NextResponse.json({
    id: updatedComponent.id,
    name: updatedComponent.name,
    code: updatedComponent.code,
    approved: updatedComponent.approved,
    failReason: analysis.failReason ?? null,
  })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id?: string }> }
) {
  // 1. Auth
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Extract id from params
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "Missing component ID" }, { status: 400 })
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

  // 4. Fetch component with ownership verification
  const component = await prisma.component.findFirst({
    where: {
      id,
      library: {
        siteId: site.id,
      },
    },
  })

  if (!component) {
    return NextResponse.json({ error: "Component not found" }, { status: 404 })
  }

  // 5. Delete
  await prisma.component.delete({ where: { id: component.id } })

  // 6. Return
  return NextResponse.json({ success: true })
}
