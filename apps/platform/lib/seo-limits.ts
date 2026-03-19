export function getScanLimit(stripePriceId: string | null | undefined): number | null {
  if (stripePriceId === process.env.STRIPE_PRICE_PRO) return null
  if (stripePriceId === process.env.STRIPE_PRICE_GROWTH) return 20
  return 5
}

export function getKeywordLimit(stripePriceId: string | null | undefined): number {
  if (stripePriceId === process.env.STRIPE_PRICE_PRO) return 999
  if (stripePriceId === process.env.STRIPE_PRICE_GROWTH) return 10
  return 3
}
