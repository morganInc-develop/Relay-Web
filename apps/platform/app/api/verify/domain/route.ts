import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import {
  generateVerifyToken,
  buildVerifyMetaTag,
  checkDomainForMetaTag,
  normalizeDomain,
  isTokenExpired,
} from "@/lib/domain-verification"
import { sendEmail } from "@/lib/email"
import { domainVerifiedEmail } from "@/lib/email-templates"

// Rate limiter — 5 attempts per hour per user
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  analytics: false,
  prefix: "relayweb:verify",
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action")

  if (action === "status") {
    const site = await prisma.site.findFirst({
      where: { ownerId: session.user.id },
      select: {
        id: true,
        domain: true,
        domainVerified: true,
        verifiedAt: true,
        verifyToken: true,
        status: true,
        name: true,
        repoUrl: true,
        payloadUrl: true,
        vercelProjectId: true,
      },
    })

    if (!site) {
      return NextResponse.json({ site: null })
    }

    return NextResponse.json({
      site: {
        ...site,
        metaTag: site.verifyToken ? buildVerifyMetaTag(site.verifyToken) : null,
      },
    })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Apply rate limiting
  const { success, limit, remaining, reset } = await ratelimit.limit(
    `verify:${session.user.id}`
  )

  if (!success) {
    return NextResponse.json(
      {
        error: "Too many verification attempts. Try again in an hour.",
        limit,
        remaining,
        reset,
      },
      { status: 429 }
    )
  }

  const body = await req.json()
  const { action } = body

  // ACTION: generate — create a new verify token
  if (action === "generate") {
    const { domain, name } = body

    if (!domain || typeof domain !== "string") {
      return NextResponse.json(
        { error: "Domain is required" },
        { status: 400 }
      )
    }

    const normalizedDomain = normalizeDomain(domain)

    // Check if domain is already claimed by another user
    const existingSite = await prisma.site.findFirst({
      where: {
        domain: normalizedDomain,
        domainVerified: true,
        ownerId: { not: session.user.id },
      },
    })

    if (existingSite) {
      return NextResponse.json(
        { error: "This domain is already verified by another account." },
        { status: 409 }
      )
    }

    const token = generateVerifyToken()
    const metaTag = buildVerifyMetaTag(token)

    // Upsert-style behavior by owner (ownerId is not unique in current schema)
    const existingOwnedSite = await prisma.site.findFirst({
      where: { ownerId: session.user.id },
      select: { id: true },
    })

    const site = existingOwnedSite
      ? await prisma.site.update({
          where: { id: existingOwnedSite.id },
          data: {
            domain: normalizedDomain,
            name: name ?? normalizedDomain,
            verifyToken: token,
            domainVerified: false,
            verifiedAt: null,
          },
        })
      : await prisma.site.create({
          data: {
            ownerId: session.user.id,
            domain: normalizedDomain,
            name: name ?? normalizedDomain,
            verifyToken: token,
            domainVerified: false,
            status: "PENDING",
          },
        })

    return NextResponse.json({
      success: true,
      siteId: site.id,
      domain: normalizedDomain,
      token,
      metaTag,
      instructions: [
        `Add the following meta tag inside the <head> of your site's main layout file:`,
        metaTag,
        `Then redeploy your site and click "Verify" in the dashboard.`,
        `This token expires in 72 hours.`,
      ],
    })
  }

  // ACTION: check — ping the domain and verify the meta tag
  if (action === "check") {
    const site = await prisma.site.findFirst({
      where: { ownerId: session.user.id },
    })

    if (!site) {
      return NextResponse.json(
        { error: "No site found. Generate a verification token first." },
        { status: 404 }
      )
    }

    if (!site.verifyToken || !site.domain) {
      return NextResponse.json(
        { error: "No verification token found. Generate one first." },
        { status: 400 }
      )
    }

    if (site.domainVerified) {
      return NextResponse.json({
        success: true,
        verified: true,
        message: "Domain is already verified.",
        domain: site.domain,
      })
    }

    // Check if token is expired
    if (isTokenExpired(site.updatedAt)) {
      return NextResponse.json(
        {
          error:
            "Verification token has expired (72 hours). Generate a new token and add it to your site.",
          expired: true,
        },
        { status: 410 }
      )
    }

    // Ping the domain
    const result = await checkDomainForMetaTag(site.domain, site.verifyToken)

    if (!result.verified) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: result.error,
          domain: site.domain,
        },
        { status: 422 }
      )
    }

    // Mark as verified in database
    await prisma.site.update({
      where: { id: site.id },
      data: {
        domainVerified: true,
        verifiedAt: new Date(),
        status: "ACTIVE",
      },
    })

    if (session.user.email) {
      try {
        await sendEmail({
          to: session.user.email,
          subject: `Domain verified — ${site.domain}`,
          html: domainVerifiedEmail(site.domain),
        })
      } catch (e) {
        console.error("[Verify] Domain verified email failed:", e)
      }
    }

    return NextResponse.json({
      success: true,
      verified: true,
      message: "Domain verified successfully.",
      domain: site.domain,
      verifiedAt: new Date().toISOString(),
    })
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
