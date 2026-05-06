import { UserRole } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { sendEmail } from "@/lib/email"
import { teamInviteEmail } from "@/lib/email-templates"
import { prisma } from "@/lib/prisma"

type InviteBody = {
  email?: string
  role?: UserRole
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: InviteBody
  try {
    body = (await req.json()) as InviteBody
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const role = body.role === UserRole.OWNER ? UserRole.OWNER : UserRole.MEMBER

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
  }

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  })

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 })
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      memberships: {
        where: { siteId: site.id },
        select: { id: true },
      },
    },
  })

  if (existingUser?.memberships.length) {
    return NextResponse.json(
      { error: "That email already belongs to this site." },
      { status: 409 }
    )
  }

  const existingInvite = await prisma.teamInvite.findFirst({
    where: {
      siteId: site.id,
      email,
      accepted: false,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  })

  if (existingInvite) {
    return NextResponse.json(
      { error: "A pending invite already exists for that email." },
      { status: 409 }
    )
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const invite = await prisma.teamInvite.create({
    data: {
      siteId: site.id,
      senderId: session.user.id,
      email,
      role,
      expiresAt,
    },
    select: { token: true },
  })

  const appUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3000"
  const inviteUrl = `${appUrl}/api/team/accept?token=${encodeURIComponent(invite.token)}`

  await sendEmail({
    to: email,
    subject: `You're invited to ${site.name ?? "a RelayWeb site"}`,
    html: teamInviteEmail(session.user.name ?? "A RelayWeb teammate", site.name ?? "RelayWeb", inviteUrl),
  })

  return NextResponse.json({ success: true })
}
