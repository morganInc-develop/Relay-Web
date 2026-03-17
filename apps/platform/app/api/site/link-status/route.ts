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
      domainVerified: true,
      repoUrl: true,
      payloadUrl: true,
      vercelProjectId: true,
      linked: true,
      linkedAt: true,
    },
  })

  if (!site) {
    return NextResponse.json({ status: "no-site" })
  }

  if (!site.domainVerified) {
    return NextResponse.json({ status: "unverified" })
  }

  if (!site.linked) {
    return NextResponse.json({ status: "verified-unlinked", domain: site.domain })
  }

  return NextResponse.json({
    status: "linked",
    domain: site.domain,
    repoUrl: site.repoUrl,
    payloadUrl: site.payloadUrl,
    vercelProjectId: site.vercelProjectId,
    linkedAt: site.linkedAt?.toISOString(),
  })
}
