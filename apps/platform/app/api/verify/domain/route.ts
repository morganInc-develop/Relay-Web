import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { sendEmail } from "@/lib/email"
import { domainVerifiedEmail } from "@/lib/email-templates"
import { checkDomainForMetaTag, buildVerifyMetaTag, generateVerifyToken, normalizeDomain } from "@/lib/domain-verification"
import { prisma } from "@/lib/prisma"
import { checkRateLimit, rateLimiters } from "@/lib/rate-limit"

const TOKEN_TTL_MS = 72 * 60 * 60 * 1000

function nextTokenExpiry(): Date {
  return new Date(Date.now() + TOKEN_TTL_MS)
}

function isExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return true
  return expiresAt.getTime() <= Date.now()
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rl = await checkRateLimit(rateLimiters.domainVerify, session.user.id)
  if (!rl.success) return rl.response!

  const body = (await req.json()) as { domain?: string }
  if (!body?.domain || typeof body.domain !== "string") {
    return NextResponse.json({ error: "Domain is required" }, { status: 400 })
  }

  const normalizedDomain = normalizeDomain(body.domain)

  const conflict = await prisma.site.findFirst({
    where: {
      domain: normalizedDomain,
      domainVerified: true,
      ownerId: { not: session.user.id },
    },
    select: { id: true },
  })
  if (conflict) {
    return NextResponse.json(
      { error: "This domain is already verified by another account." },
      { status: 409 }
    )
  }

  let site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
  })

  if (!site) {
    const token = generateVerifyToken()
    const expiresAt = nextTokenExpiry()
    site = await prisma.site.create({
      data: {
        ownerId: session.user.id,
        domain: normalizedDomain,
        name: normalizedDomain,
        verifyToken: token,
        verifyTokenExp: expiresAt,
        domainVerified: false,
        status: "PENDING",
      },
    })
  } else if (site.domain !== normalizedDomain) {
    const token = generateVerifyToken()
    const expiresAt = nextTokenExpiry()
    site = await prisma.site.update({
      where: { id: site.id },
      data: {
        domain: normalizedDomain,
        name: site.name ?? normalizedDomain,
        domainVerified: false,
        verifiedAt: null,
        verifyToken: token,
        verifyTokenExp: expiresAt,
        linked: false,
        linkedAt: null,
      },
    })
  }

  if (!site.verifyToken || isExpired(site.verifyTokenExp)) {
    const refreshedToken = generateVerifyToken()
    const refreshedExpiry = nextTokenExpiry()

    site = await prisma.site.update({
      where: { id: site.id },
      data: {
        verifyToken: refreshedToken,
        verifyTokenExp: refreshedExpiry,
        domainVerified: false,
        verifiedAt: null,
      },
    })

    return NextResponse.json({
      verified: false,
      domain: site.domain,
      token: refreshedToken,
      metaTag: buildVerifyMetaTag(refreshedToken),
      expiresAt: refreshedExpiry.toISOString(),
      message:
        "Your previous verification token expired after 72 hours. A new token has been generated.",
      expired: true,
    })
  }

  if (site.domainVerified) {
    return NextResponse.json({
      verified: true,
      domain: site.domain,
      verifiedAt: site.verifiedAt?.toISOString() ?? new Date().toISOString(),
      message: "Domain is already verified.",
    })
  }

  const verifyResult = await checkDomainForMetaTag(normalizedDomain, site.verifyToken)
  if (!verifyResult.verified) {
    return NextResponse.json({
      verified: false,
      domain: normalizedDomain,
      token: site.verifyToken,
      metaTag: buildVerifyMetaTag(site.verifyToken),
      expiresAt: site.verifyTokenExp?.toISOString() ?? nextTokenExpiry().toISOString(),
      message:
        verifyResult.error ??
        "Verification tag not found. Add the tag to your site <head>, redeploy, and try again.",
    })
  }

  const verifiedAt = new Date()
  await prisma.site.update({
    where: { id: site.id },
    data: {
      domainVerified: true,
      verifiedAt,
      verifyToken: null,
      verifyTokenExp: null,
      status: "ACTIVE",
    },
  })

  if (session.user.email) {
    try {
      await sendEmail({
        to: session.user.email,
        subject: `Domain verified — ${normalizedDomain}`,
        html: domainVerifiedEmail(normalizedDomain),
      })
    } catch (error) {
      console.error("[Verify] Domain verified email failed:", error)
    }
  }

  return NextResponse.json({
    verified: true,
    domain: normalizedDomain,
    verifiedAt: verifiedAt.toISOString(),
    message: "Domain verified successfully.",
  })
}
