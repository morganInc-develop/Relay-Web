import { prisma } from "@/lib/prisma"
import { SubscriptionTier } from "@prisma/client"
import { NextResponse } from "next/server"

export async function getSiteForUser(
  siteId: string,
  userId: string
): Promise<{ site: Awaited<ReturnType<typeof prisma.site.findUnique>> | null; response?: NextResponse }> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
  })

  if (!site) {
    return {
      site: null,
      response: NextResponse.json({ error: "Site not found" }, { status: 404 }),
    }
  }

  // Check ownership — ownerId must match userId
  if (site.ownerId !== userId) {
    // Also check if user is a member of this site
    const membership = await prisma.siteMember.findFirst({
      where: { siteId, userId },
    })

    if (!membership) {
      return {
        site: null,
        response: NextResponse.json({ error: "Access denied" }, { status: 403 }),
      }
    }
  }

  return { site }
}

export async function getUserSubscription(userId: string) {
  return prisma.subscription.findUnique({
    where: { userId },
  })
}

export function tierAllows(
  userTier: SubscriptionTier,
  requiredTier: SubscriptionTier
): boolean {
  const tierOrder = {
    [SubscriptionTier.TIER1]: 1,
    [SubscriptionTier.TIER2]: 2,
    [SubscriptionTier.TIER3]: 3,
  }
  return tierOrder[userTier] >= tierOrder[requiredTier]
}

export function tierNotAllowedResponse(feature: string): NextResponse {
  return NextResponse.json(
    {
      error: `Your current plan does not include ${feature}. Upgrade to access this feature.`,
      upgradeRequired: true,
    },
    { status: 403 }
  )
}
