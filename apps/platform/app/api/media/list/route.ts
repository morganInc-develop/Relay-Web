import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const siteId = req.nextUrl.searchParams.get("siteId")
  if (!siteId) {
    return NextResponse.json({ error: "siteId is required" }, { status: 400 })
  }

  const site = await prisma.site.findFirst({
    where: {
      id: siteId,
      ownerId: session.user.id,
    },
    select: { id: true },
  })

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 })
  }

  const assets = await prisma.mediaAsset.findMany({
    where: { siteId },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(assets)
}
