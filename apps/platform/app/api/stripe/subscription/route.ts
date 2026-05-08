import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncSubscriptionFromCheckoutSession } from "@/lib/stripe-subscription-sync";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");
  if (sessionId) {
    try {
      await syncSubscriptionFromCheckoutSession(sessionId, session.user.id);
    } catch (error) {
      console.error("[stripe/subscription] failed to sync checkout session", error);
    }
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ subscription: subscription ?? null });
}
