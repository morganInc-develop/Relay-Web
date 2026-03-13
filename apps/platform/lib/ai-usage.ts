import { prisma } from "@/lib/prisma"
import { SubscriptionTier } from "@prisma/client"
import { NextResponse } from "next/server"

const MONTHLY_LIMITS: Record<SubscriptionTier, number | null> = {
  [SubscriptionTier.TIER1]: 50,
  [SubscriptionTier.TIER2]: 150,
  [SubscriptionTier.TIER3]: null, // Unlimited
}

const DAILY_LIMITS: Record<SubscriptionTier, number | null> = {
  [SubscriptionTier.TIER1]: 5,
  [SubscriptionTier.TIER2]: 10,
  [SubscriptionTier.TIER3]: null, // Unlimited
}

export interface UsageCheckResult {
  allowed: boolean
  response?: NextResponse
  monthlyUsed: number
  monthlyLimit: number | null
}

export async function checkAndIncrementAIUsage(
  siteId: string,
  tier: SubscriptionTier
): Promise<UsageCheckResult> {
  const monthlyLimit = MONTHLY_LIMITS[tier]

  // Tier 3 is unlimited — skip all checks
  if (monthlyLimit === null) {
    await prisma.aIUsage.upsert({
      where: { siteId },
      create: { siteId, chatRequests: 1, seoAudits: 0 },
      update: { chatRequests: { increment: 1 } },
    })
    return { allowed: true, monthlyUsed: 0, monthlyLimit: null }
  }

  // Get or create usage record
  const usage = await prisma.aIUsage.upsert({
    where: { siteId },
    create: { siteId, chatRequests: 0, seoAudits: 0 },
    update: {},
  })

  // Check monthly limit
  if (usage.chatRequests >= monthlyLimit) {
    return {
      allowed: false,
      monthlyUsed: usage.chatRequests,
      monthlyLimit,
      response: NextResponse.json(
        {
          error: `You have used all ${monthlyLimit} AI requests for this month. Upgrade your plan for more.`,
          upgradeRequired: true,
          used: usage.chatRequests,
          limit: monthlyLimit,
        },
        { status: 429 }
      ),
    }
  }

  // Increment usage
  await prisma.aIUsage.update({
    where: { siteId },
    data: { chatRequests: { increment: 1 } },
  })

  return {
    allowed: true,
    monthlyUsed: usage.chatRequests + 1,
    monthlyLimit,
  }
}

export async function getAIUsageForSite(siteId: string) {
  return prisma.aIUsage.findUnique({ where: { siteId } })
}

export { DAILY_LIMITS, MONTHLY_LIMITS }
