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
    select: {
      domain: true,
      verifyToken: true,
      verifyTokenExp: true,
      domainVerified: true,
      verifiedAt: true,
      updatedAt: true,
    },
  })

  // No site record yet
  if (!site || !site.domain || !site.verifyToken) {
    return NextResponse.json({ status: "none" })
  }

  // Already verified
  if (site.domainVerified) {
    return NextResponse.json({
      status: "verified",
      domain: site.domain,
      verifiedAt: site.verifiedAt?.toISOString() ?? new Date().toISOString(),
    })
  }

  // Determine expiry — prefer explicit verifyTokenExp, fall back to updatedAt + 72h
  const expiresAt: Date = site.verifyTokenExp
    ? site.verifyTokenExp
    : new Date(site.updatedAt.getTime() + 72 * 60 * 60 * 1000)

  if (expiresAt < new Date()) {
    return NextResponse.json({ status: "expired", domain: site.domain })
  }

  return NextResponse.json({
    status: "pending",
    domain: site.domain,
    token: site.verifyToken,
    expiresAt: expiresAt.toISOString(),
  })
}
