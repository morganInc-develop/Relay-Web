import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface AcceptBody {
  token?: string;
}

export async function POST(req: NextRequest) {
  // 1. Auth
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let body: AcceptBody;
  try {
    body = (await req.json()) as AcceptBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // 3. Validate token
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  // 4. Look up invite
  const invite = await prisma.teamInvite.findUnique({ where: { token } });
  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  // 5. Check accepted
  if (invite.accepted) {
    return NextResponse.json({ error: "Invite already accepted" }, { status: 409 });
  }

  // 6. Check expiry
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
  }

  // 7. Check email match
  const sessionEmail = session.user.email?.trim().toLowerCase() ?? "";
  const inviteEmail = invite.email.trim().toLowerCase();
  if (sessionEmail !== inviteEmail) {
    return NextResponse.json(
      { error: "This invite was sent to a different email address" },
      { status: 403 }
    );
  }

  // 8. Transaction
  await prisma.$transaction([
    prisma.siteMember.upsert({
      where: {
        siteId_userId: {
          siteId: invite.siteId,
          userId: session.user.id,
        },
      },
      update: {},
      create: {
        siteId: invite.siteId,
        userId: session.user.id,
        role: invite.role,
      },
    }),
    prisma.teamInvite.update({
      where: { token },
      data: { accepted: true },
    }),
  ]);

  // 9. Return
  return NextResponse.json({ success: true, siteId: invite.siteId });
}
