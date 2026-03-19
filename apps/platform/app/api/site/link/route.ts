import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { encrypt } from "@/lib/encrypt"
import { sendEmail } from "@/lib/email"
import { subscriptionActivatedEmail } from "@/lib/email-templates"

function validateHttpUrl(value: string, field: string): string | null {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return `${field} must use http or https`
    }
    return null
  } catch {
    return `${field} must be a valid URL`
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true, domainVerified: true, r2Prefix: true },
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

  const repoUrlError = validateHttpUrl(repoUrl, "repoUrl")
  if (repoUrlError) {
    return NextResponse.json({ error: repoUrlError }, { status: 400 })
  }

  const payloadUrlError = validateHttpUrl(payloadUrl, "payloadUrl")
  if (payloadUrlError) {
    return NextResponse.json({ error: payloadUrlError }, { status: 400 })
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
      r2Prefix: site.r2Prefix ?? `sites/${site.id}`,
      linked: true,
      linkedAt: new Date(),
      status: "ACTIVE",
    },
    select: {
      domain: true,
      repoUrl: true,
      payloadUrl: true,
      vercelProjectId: true,
      r2Prefix: true,
      linked: true,
      linkedAt: true,
    },
  })

  if (session.user.email) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
      select: { tier: true },
    })

    const tierName =
      subscription?.tier === "TIER3"
        ? "Pro"
        : subscription?.tier === "TIER2"
          ? "Growth"
          : "Starter"

    try {
      await sendEmail({
        to: session.user.email,
        subject: "Your RelayWeb subscription is active",
        html: subscriptionActivatedEmail(session.user.name ?? "there", tierName),
      })
    } catch (error) {
      console.error("[SiteLink] Subscription activation email failed:", error)
    }
  }

  return NextResponse.json({ success: true, site: updated })
}
