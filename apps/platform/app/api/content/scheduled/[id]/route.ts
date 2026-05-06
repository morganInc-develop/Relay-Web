import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await context.params

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 })
  }

  const scheduledChange = await prisma.scheduledChange.findFirst({
    where: {
      id,
      siteId: site.id,
      status: "SCHEDULED",
    },
    select: { id: true },
  })

  if (!scheduledChange) {
    return NextResponse.json({ error: "Scheduled change not found" }, { status: 404 })
  }

  await prisma.scheduledChange.update({
    where: { id },
    data: { status: "DISCARDED" },
  })

  return NextResponse.json({ success: true })
}
