import { SubscriptionStatus, SubscriptionTier } from "@prisma/client";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const TIER_CONFIG: Record<
  string,
  { tier: SubscriptionTier; priceIdEnvName: string }
> = {
  "1": {
    tier: SubscriptionTier.TIER1,
    priceIdEnvName: "STRIPE_PRICE_ID_TIER1",
  },
  "2": {
    tier: SubscriptionTier.TIER2,
    priceIdEnvName: "STRIPE_PRICE_ID_TIER2",
  },
  "3": {
    tier: SubscriptionTier.TIER3,
    priceIdEnvName: "STRIPE_PRICE_ID_TIER3",
  },
};

function resolveAppOrigin(requestUrl: string): string {
  return process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? new URL(requestUrl).origin;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tierParam = requestUrl.searchParams.get("tier");

  if (!tierParam || !TIER_CONFIG[tierParam]) {
    return NextResponse.redirect(new URL("/onboarding?error=invalid-tier", request.url));
  }

  const session = await auth();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email ?? null;

  if (!userId) {
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", requestUrl.pathname + requestUrl.search);
    return NextResponse.redirect(signInUrl);
  }

  if (!userEmail) {
    return NextResponse.redirect(new URL("/onboarding?error=missing-email", request.url));
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    console.error("[billing] STRIPE_SECRET_KEY is missing");
    return NextResponse.redirect(
      new URL("/onboarding?error=checkout-not-configured", request.url),
    );
  }

  const tierConfig = TIER_CONFIG[tierParam];
  const priceId = process.env[tierConfig.priceIdEnvName];

  if (!priceId) {
    console.error(
      `[billing] ${tierConfig.priceIdEnvName} is missing for tier ${tierConfig.tier}`,
    );
    return NextResponse.redirect(
      new URL("/onboarding?error=checkout-not-configured", request.url),
    );
  }

  try {
    const stripe = new Stripe(stripeSecretKey);

    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId },
      select: { stripeCustomerId: true },
    });

    let customerId = existingSubscription?.stripeCustomerId ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        name: session.user.name ?? undefined,
        metadata: { userId },
      });

      customerId = customer.id;
    }

    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        tier: tierConfig.tier,
        status: SubscriptionStatus.INACTIVE,
        stripeCustomerId: customerId,
        stripePriceId: priceId,
      },
      update: {
        tier: tierConfig.tier,
        stripePriceId: priceId,
        ...(customerId ? { stripeCustomerId: customerId } : {}),
      },
    });

    const appOrigin = resolveAppOrigin(request.url);

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      client_reference_id: userId,
      metadata: {
        userId,
        tier: tierConfig.tier,
      },
      subscription_data: {
        metadata: {
          userId,
          tier: tierConfig.tier,
        },
      },
      success_url: `${appOrigin}/dashboard?checkout=success`,
      cancel_url: `${appOrigin}/onboarding?checkout=cancelled`,
    });

    if (!checkoutSession.url) {
      throw new Error("Stripe checkout session returned without a URL");
    }

    return NextResponse.redirect(checkoutSession.url, { status: 303 });
  } catch (error) {
    console.error("[billing] failed to create checkout session", error);
    return NextResponse.redirect(new URL("/onboarding?error=checkout-failed", request.url));
  }
}
