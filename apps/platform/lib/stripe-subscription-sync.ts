import { SubscriptionStatus, SubscriptionTier } from "@prisma/client"
import type Stripe from "stripe"

import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe"

type StripeSubscriptionWithPeriods = Stripe.Subscription & {
  current_period_start?: number
  current_period_end?: number
}

const PRICE_ID_TO_TIER: Record<string, SubscriptionTier> = {
  ...(process.env.STRIPE_PRICE_STARTER ? { [process.env.STRIPE_PRICE_STARTER]: SubscriptionTier.TIER1 } : {}),
  ...(process.env.STRIPE_PRICE_GROWTH ? { [process.env.STRIPE_PRICE_GROWTH]: SubscriptionTier.TIER2 } : {}),
  ...(process.env.STRIPE_PRICE_PRO ? { [process.env.STRIPE_PRICE_PRO]: SubscriptionTier.TIER3 } : {}),
}

function mapTierFromPriceId(priceId: string | null | undefined): SubscriptionTier | null {
  if (!priceId) return null
  return PRICE_ID_TO_TIER[priceId] ?? null
}

function toDateOrNull(unixSeconds: number | undefined): Date | null {
  if (typeof unixSeconds !== "number" || !Number.isFinite(unixSeconds)) {
    return null
  }
  return new Date(unixSeconds * 1000)
}

function resolveSubscriptionPeriods(subscription: StripeSubscriptionWithPeriods): {
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
} {
  const firstItem = subscription.items.data[0] as
    | { current_period_start?: number; current_period_end?: number }
    | undefined

  const startSeconds = subscription.current_period_start ?? firstItem?.current_period_start
  const endSeconds = subscription.current_period_end ?? firstItem?.current_period_end

  return {
    currentPeriodStart: toDateOrNull(startSeconds),
    currentPeriodEnd: toDateOrNull(endSeconds),
  }
}

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  const statusMap: Partial<Record<Stripe.Subscription.Status, SubscriptionStatus>> = {
    active: SubscriptionStatus.ACTIVE,
    canceled: SubscriptionStatus.CANCELLED,
    past_due: SubscriptionStatus.PAST_DUE,
    trialing: SubscriptionStatus.TRIALING,
  }

  return statusMap[status] ?? SubscriptionStatus.INACTIVE
}

export async function syncSubscriptionFromCheckoutSession(sessionId: string, userId: string) {
  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId)
  const metadataUserId = checkoutSession.metadata?.userId
  const stripeSubscriptionId =
    typeof checkoutSession.subscription === "string" ? checkoutSession.subscription : null
  const stripeCustomerId = typeof checkoutSession.customer === "string" ? checkoutSession.customer : null

  if (metadataUserId && metadataUserId !== userId) {
    throw new Error("Checkout session does not belong to the authenticated user")
  }

  if (
    checkoutSession.status !== "complete" ||
    checkoutSession.payment_status !== "paid" ||
    !stripeSubscriptionId ||
    !stripeCustomerId
  ) {
    return null
  }

  const stripeSubscription = (await stripe.subscriptions.retrieve(
    stripeSubscriptionId,
  )) as unknown as StripeSubscriptionWithPeriods
  const { currentPeriodStart, currentPeriodEnd } = resolveSubscriptionPeriods(stripeSubscription)
  const stripePriceId = stripeSubscription.items.data[0]?.price.id ?? null
  const subscriptionTier = mapTierFromPriceId(stripePriceId) ?? SubscriptionTier.TIER1
  const status = mapStripeSubscriptionStatus(stripeSubscription.status)

  return prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      tier: subscriptionTier,
      status,
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    },
    update: {
      tier: subscriptionTier,
      status,
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    },
  })
}
