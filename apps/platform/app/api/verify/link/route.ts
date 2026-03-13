import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface LinkSiteBody {
  repoUrl?: string
  payloadUrl?: string
  neonDatabaseUrl?: string
  vercelProjectId?: string
  r2Prefix?: string
  whitelabelUrl?: string
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Find the user's site — must be verified before linking
  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
  })

  if (!site) {
    return NextResponse.json(
      { error: "No site found. Complete domain verification first." },
      { status: 404 }
    )
  }

  if (!site.domainVerified) {
    return NextResponse.json(
      { error: "Domain must be verified before linking site details." },
      { status: 403 }
    )
  }

  const body: LinkSiteBody = await req.json()

  const {
    repoUrl,
    payloadUrl,
    neonDatabaseUrl,
    vercelProjectId,
    r2Prefix,
    whitelabelUrl,
  } = body

  // Validate URL formats if provided
  const urlFields = { repoUrl, payloadUrl, whitelabelUrl }
  for (const [field, value] of Object.entries(urlFields)) {
    if (value && typeof value === "string") {
      try {
        new URL(value)
      } catch {
        return NextResponse.json(
          { error: `Invalid URL format for ${field}: ${value}` },
          { status: 400 }
        )
      }
    }
  }

  // Update the site with linking details
  const updatedSite = await prisma.site.update({
    where: { id: site.id },
    data: {
      ...(repoUrl !== undefined && { repoUrl }),
      ...(payloadUrl !== undefined && { payloadUrl }),
      ...(neonDatabaseUrl !== undefined && { neonDatabaseUrl }),
      ...(vercelProjectId !== undefined && { vercelProjectId }),
      ...(r2Prefix !== undefined && { r2Prefix }),
      ...(whitelabelUrl !== undefined && { whitelabelUrl }),
    },
    select: {
      id: true,
      domain: true,
      name: true,
      domainVerified: true,
      verifiedAt: true,
      repoUrl: true,
      payloadUrl: true,
      vercelProjectId: true,
      r2Prefix: true,
      whitelabelUrl: true,
      status: true,
    },
  })

  return NextResponse.json({
    success: true,
    message: "Site linked successfully.",
    site: updatedSite,
  })
}
