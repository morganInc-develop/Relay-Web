import { SubscriptionStatus, SubscriptionTier } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

const PRICE_ID_BY_TIER: Record<number, string | undefined> = {
  1: process.env.STRIPE_PRICE_ID_TIER1,
  2: process.env.STRIPE_PRICE_ID_TIER2,
  3: process.env.STRIPE_PRICE_ID_TIER3,
};

const PRISMA_TIER_BY_TIER: Record<number, SubscriptionTier> = {
  1: SubscriptionTier.TIER1,
  2: SubscriptionTier.TIER2,
  3: SubscriptionTier.TIER3,
};

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { tier?: number };
  const tier = Number(body?.tier);

  if (![1, 2, 3].includes(tier)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const priceId = PRICE_ID_BY_TIER[tier];
  if (!priceId) {
    throw new Error(`Missing Stripe price ID for tier ${tier}`);
  }

  const appUrl = process.env.NEXTAUTH_URL;
  if (!appUrl) {
    throw new Error("NEXTAUTH_URL is not set");
  }

  const existingSubscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { stripeCustomerId: true },
  });

  let stripeCustomerId = existingSubscription?.stripeCustomerId ?? null;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: session.user.email,
      name: session.user.name ?? undefined,
    });

    stripeCustomerId = customer.id;
  }

  await prisma.subscription.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      tier: PRISMA_TIER_BY_TIER[tier],
      status: SubscriptionStatus.INACTIVE,
      stripeCustomerId,
      stripePriceId: priceId,
    },
    update: {
      tier: PRISMA_TIER_BY_TIER[tier],
      stripeCustomerId,
      stripePriceId: priceId,
    },
  });

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/onboarding/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/onboarding`,
    metadata: { userId: session.user.id, tier: String(tier) },
    subscription_data: {
      metadata: { userId: session.user.id, tier: String(tier) },
    },
    allow_promotion_codes: true,
    billing_address_collection: "auto",
  });

  if (!checkoutSession.url) {
    throw new Error("Stripe checkout session did not return a URL");
  }

  return NextResponse.json({ url: checkoutSession.url });
}
