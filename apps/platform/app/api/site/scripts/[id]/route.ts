import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { hasTier3Access } from "@/lib/design-tier"
import { prisma } from "@/lib/prisma"

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
    return NextResponse.json({ error: "Missing script ID" }, { status: 400 })
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

  // 5. Ownership check
  const script = await prisma.scriptInjection.findFirst({
    where: {
      id,
      siteId: site.id,
    },
  })

  if (!script) {
    return NextResponse.json({ error: "Script not found" }, { status: 404 })
  }

  // 6. Tier gate
  if (!hasTier3Access(subscription?.stripePriceId)) {
    return NextResponse.json(
      { error: "Script injection requires Tier 3" },
      { status: 403 }
    )
  }

  // 7. No rate limit on DELETE

  // 8. Delete
  await prisma.scriptInjection.delete({ where: { id: script.id } })

  // 9. Return
  return NextResponse.json({ success: true })
}
