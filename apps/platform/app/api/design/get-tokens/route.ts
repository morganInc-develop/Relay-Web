import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 })
  }

  const tokens = await prisma.designToken.findMany({
    where: { siteId: site.id },
    select: {
      key: true,
      value: true,
    },
  })

  const tokenMap: Record<string, string> = {}
  for (const token of tokens) {
    tokenMap[token.key] = token.value
  }

  return NextResponse.json({ tokens: tokenMap })
}
