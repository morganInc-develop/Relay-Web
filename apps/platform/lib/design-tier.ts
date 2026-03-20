// Returns true if the stripePriceId is Tier 2 or Tier 3
export function hasDesignAccess(stripePriceId?: string | null): boolean {
  const allowed = [
    process.env.STRIPE_PRICE_T2!,
    process.env.STRIPE_PRICE_T3!,
  ]
  return !!stripePriceId && allowed.includes(stripePriceId)
}

// Returns true if the stripePriceId is Tier 3 (Pro) only
export function hasTier3Access(stripePriceId?: string | null): boolean {
  return !!stripePriceId && stripePriceId === process.env.STRIPE_PRICE_T3!
}
