import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface AcceptBody {
  token?: string;
}

function getAppUrl(req: NextRequest): string {
  return process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? req.nextUrl.origin;
}

async function acceptInvite(token: string, userId: string, userEmail?: string | null) {
  const invite = await prisma.teamInvite.findUnique({ where: { token } });
  if (!invite) {
    return { error: "Invite not found", status: 404 };
  }

  if (invite.accepted) {
    return { error: "Invite already accepted", status: 409 };
  }

  if (invite.expiresAt < new Date()) {
    return { error: "Invite has expired", status: 410 };
  }

  const sessionEmail = userEmail?.trim().toLowerCase() ?? "";
  const inviteEmail = invite.email.trim().toLowerCase();
  if (sessionEmail !== inviteEmail) {
    return { error: "This invite was sent to a different email address", status: 403 };
  }

  await prisma.$transaction([
    prisma.siteMember.upsert({
      where: {
        siteId_userId: {
          siteId: invite.siteId,
          userId,
        },
      },
      update: {},
      create: {
        siteId: invite.siteId,
        userId,
        role: invite.role,
      },
    }),
    prisma.teamInvite.update({
      where: { token },
      data: { accepted: true },
    }),
  ]);

  return { success: true, siteId: invite.siteId, status: 200 };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const token = req.nextUrl.searchParams.get("token")?.trim() ?? "";

  if (!token) {
    return NextResponse.redirect(new URL("/auth/error?error=InviteTokenMissing", getAppUrl(req)));
  }

  if (!session?.user?.id) {
    const callbackUrl = `/invite/accept?token=${encodeURIComponent(token)}`;
    const signinUrl = new URL("/auth/signin", getAppUrl(req));
    signinUrl.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(signinUrl);
  }

  const result = await acceptInvite(token, session.user.id, session.user.email);
  const redirectUrl = new URL("/dashboard/team", getAppUrl(req));

  if ("success" in result) {
    redirectUrl.searchParams.set("invite", "accepted");
  } else {
    redirectUrl.searchParams.set("invite", "error");
    redirectUrl.searchParams.set("message", result.error);
  }

  return NextResponse.redirect(redirectUrl);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: AcceptBody;
  try {
    body = (await req.json()) as AcceptBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const result = await acceptInvite(token, session.user.id, session.user.email);
  if (!("success" in result)) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true, siteId: result.siteId });
}
