import { SubscriptionStatus, SubscriptionTier } from "@prisma/client"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

const PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_STARTER,
  growth: process.env.STRIPE_PRICE_GROWTH,
  pro: process.env.STRIPE_PRICE_PRO,
} as const

const TIER_BY_PRICE_ID: Record<string, SubscriptionTier> = {
  ...(PRICE_IDS.starter ? { [PRICE_IDS.starter]: SubscriptionTier.TIER1 } : {}),
  ...(PRICE_IDS.growth ? { [PRICE_IDS.growth]: SubscriptionTier.TIER2 } : {}),
  ...(PRICE_IDS.pro ? { [PRICE_IDS.pro]: SubscriptionTier.TIER3 } : {}),
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json()) as { priceId?: string }
  const priceId = typeof body?.priceId === "string" ? body.priceId.trim() : ""
  if (!priceId || !TIER_BY_PRICE_ID[priceId]) {
    return NextResponse.json({ error: "Invalid priceId" }, { status: 400 })
  }

  const appUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL
  if (!appUrl) {
    return NextResponse.json({ error: "App URL not configured" }, { status: 500 })
  }

  const existingSubscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { stripeCustomerId: true },
  })
  const stripeCustomerId = existingSubscription?.stripeCustomerId ?? null

  await prisma.subscription.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      tier: TIER_BY_PRICE_ID[priceId],
      status: SubscriptionStatus.INACTIVE,
      stripeCustomerId: stripeCustomerId ?? undefined,
      stripePriceId: priceId,
    },
    update: {
      tier: TIER_BY_PRICE_ID[priceId],
      stripeCustomerId: stripeCustomerId ?? undefined,
      stripePriceId: priceId,
    },
  })

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    ...(stripeCustomerId ? { customer: stripeCustomerId } : { customer_email: session.user.email }),
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/onboarding`,
    metadata: { userId: session.user.id },
    subscription_data: {
      metadata: { userId: session.user.id },
    },
  })

  if (!checkoutSession.url) {
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 })
  }

  return NextResponse.json({ url: checkoutSession.url })
}
