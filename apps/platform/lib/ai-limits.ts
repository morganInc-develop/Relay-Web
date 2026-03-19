export type AiLimits = {
  dailyCap: number | null
  monthlyCap: number | null
}

export function getDailyLimit(stripePriceId: string | null | undefined): number | null {
  if (stripePriceId === process.env.STRIPE_PRICE_PRO) {
    return null
  }

  if (stripePriceId === process.env.STRIPE_PRICE_GROWTH) {
    return 10
  }

  return 5
}

export function getMonthlyLimit(stripePriceId: string | null | undefined): number | null {
  if (stripePriceId === process.env.STRIPE_PRICE_PRO) {
    return null
  }

  if (stripePriceId === process.env.STRIPE_PRICE_GROWTH) {
    return 150
  }

  return 50
}

export function getAiLimits(priceId: string | null | undefined): AiLimits {
  return {
    dailyCap: getDailyLimit(priceId),
    monthlyCap: getMonthlyLimit(priceId),
  }
}
