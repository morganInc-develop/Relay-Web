import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

  // 3. Fetch library and components
  const library = await prisma.componentLibrary.findUnique({
    where: { siteId: site.id },
    include: { components: { orderBy: { createdAt: "desc" } } },
  })

  // 4. Return
  return NextResponse.json({ components: library?.components ?? [] })
}
