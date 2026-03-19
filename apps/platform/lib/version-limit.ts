export function getVersionLimit(stripePriceId: string | null | undefined): number {
  if (stripePriceId === process.env.STRIPE_PRICE_PRO) return 30
  return 10
}
