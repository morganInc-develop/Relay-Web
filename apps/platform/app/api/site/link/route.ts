import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { encrypt } from "@/lib/encrypt"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true, domainVerified: true },
  })

  if (!site) {
    return NextResponse.json({ error: "No site found. Verify your domain first." }, { status: 404 })
  }

  if (!site.domainVerified) {
    return NextResponse.json(
      { error: "Domain must be verified before linking your site." },
      { status: 403 }
    )
  }

  const body = await req.json()
  const { repoUrl, payloadUrl, clientDbUrl, vercelProjectId } = body

  if (!repoUrl || !payloadUrl || !clientDbUrl) {
    return NextResponse.json(
      { error: "repoUrl, payloadUrl, and clientDbUrl are required." },
      { status: 400 }
    )
  }

  let encryptedDbUrl: string
  try {
    encryptedDbUrl = encrypt(clientDbUrl)
  } catch {
    return NextResponse.json(
      { error: "Encryption configuration error. Contact support." },
      { status: 500 }
    )
  }

  const updated = await prisma.site.update({
    where: { id: site.id },
    data: {
      repoUrl,
      payloadUrl,
      neonDatabaseUrl: encryptedDbUrl,
      vercelProjectId: vercelProjectId ?? null,
      linked: true,
      linkedAt: new Date(),
      status: "ACTIVE",
    },
    select: {
      domain: true,
      repoUrl: true,
      payloadUrl: true,
      vercelProjectId: true,
      linked: true,
      linkedAt: true,
    },
  })

  return NextResponse.json({ success: true, site: updated })
}
