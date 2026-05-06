import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const page = req.nextUrl.searchParams.get("page")?.trim()

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 })
  }

  const scheduledChanges = await prisma.scheduledChange.findMany({
    where: {
      siteId: site.id,
      ...(page ? { page } : {}),
      status: "SCHEDULED",
    },
    orderBy: { publishAt: "asc" },
    select: {
      id: true,
      page: true,
      field: true,
      value: true,
      publishAt: true,
      status: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ scheduledChanges })
}
