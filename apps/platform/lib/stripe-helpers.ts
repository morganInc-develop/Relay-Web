import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { SubscriptionTier } from "@prisma/client"

/**
 * Get an existing Stripe customer ID for a user or create a new one.
 * Saves the customer ID to the Subscription table immediately.
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name: string | null
): Promise<string> {
  // Check if the user already has a Stripe customer ID
  const existing = await prisma.subscription.findUnique({
    where: { userId },
    select: { stripeCustomerId: true },
  })

  if (existing?.stripeCustomerId) {
    return existing.stripeCustomerId
  }

  // Create a new Stripe customer
  const customer = await stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: { userId },
  })

  // Save to database immediately
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId: customer.id,
      tier: SubscriptionTier.TIER1,
    },
    update: {
      stripeCustomerId: customer.id,
    },
  })

  return customer.id
}

/**
 * Map a tier number to the corresponding Stripe price ID from env vars.
 */
export function getTierPriceId(tier: 1 | 2 | 3): string {
  const map: Record<number, string | undefined> = {
    1: process.env.STRIPE_PRICE_ID_TIER1,
    2: process.env.STRIPE_PRICE_ID_TIER2,
    3: process.env.STRIPE_PRICE_ID_TIER3,
  }
  const priceId = map[tier]
  if (!priceId) {
    throw new Error(`No price ID configured for tier ${tier}`)
  }
  return priceId
}

/**
 * Map a tier number to the corresponding Prisma SubscriptionTier enum.
 */
export function getSubscriptionTierEnum(tier: 1 | 2 | 3): SubscriptionTier {
  const map: Record<number, SubscriptionTier> = {
    1: SubscriptionTier.TIER1,
    2: SubscriptionTier.TIER2,
    3: SubscriptionTier.TIER3,
  }
  return map[tier]
}

/**
 * Cancel a Stripe subscription at the end of the current billing period.
 */
export async function cancelSubscription(
  stripeSubscriptionId: string
): Promise<void> {
  await stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: true,
  })

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId },
    data: { cancelAtPeriodEnd: true },
  })
}

/**
 * Reactivate a Stripe subscription that was set to cancel at period end.
 */
export async function reactivateSubscription(
  stripeSubscriptionId: string
): Promise<void> {
  await stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: false,
  })

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId },
    data: { cancelAtPeriodEnd: false },
  })
}
