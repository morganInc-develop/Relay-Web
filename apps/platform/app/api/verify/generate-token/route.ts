import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  generateVerifyToken,
  buildVerifyMetaTag,
  normalizeDomain,
} from "@/lib/domain-verification"
import { checkRateLimit, rateLimiters } from "@/lib/rate-limit"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rl = await checkRateLimit(rateLimiters.domainVerify, session.user.id)
  if (!rl.success) return rl.response!

  const body = await req.json()
  const { domain } = body

  if (!domain || typeof domain !== "string") {
    return NextResponse.json({ error: "Domain is required" }, { status: 400 })
  }

  const normalizedDomain = normalizeDomain(domain)

  // Reject if domain is already verified by another account
  const conflict = await prisma.site.findFirst({
    where: {
      domain: normalizedDomain,
      domainVerified: true,
      ownerId: { not: session.user.id },
    },
  })

  if (conflict) {
    return NextResponse.json(
      { error: "This domain is already verified by another account." },
      { status: 409 }
    )
  }

  const token = generateVerifyToken()
  const metaTag = buildVerifyMetaTag(token)
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)

  const existing = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  })

  await (existing
    ? prisma.site.update({
        where: { id: existing.id },
        data: {
          domain: normalizedDomain,
          name: normalizedDomain,
          verifyToken: token,
          verifyTokenExp: expiresAt,
          domainVerified: false,
          verifiedAt: null,
        },
      })
    : prisma.site.create({
        data: {
          ownerId: session.user.id,
          domain: normalizedDomain,
          name: normalizedDomain,
          verifyToken: token,
          verifyTokenExp: expiresAt,
          domainVerified: false,
          status: "PENDING",
        },
      }))

  return NextResponse.json({
    token,
    domain: normalizedDomain,
    metaTag,
    expiresAt: expiresAt.toISOString(),
  })
}
