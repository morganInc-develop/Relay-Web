import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { SubscriptionStatus } from "@prisma/client"
import AIChatInterface from "./AIChatInterface"

const TIER_LABELS: Record<string, string> = {
  TIER1: "Starter",
  TIER2: "Growth",
  TIER3: "Pro",
}

const MONTHLY_LIMITS: Record<string, number | null> = {
  TIER1: 50,
  TIER2: 150,
  TIER3: null,
}

export default async function AIPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  })

  if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
    redirect("/onboarding")
  }

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
  })

  const usage = site
    ? await prisma.aIUsage.findUnique({ where: { siteId: site.id } })
    : null

  const monthlyLimit = MONTHLY_LIMITS[subscription.tier]
  const monthlyUsed = usage?.chatRequests ?? 0
  const monthlyRemaining =
    monthlyLimit === null ? null : Math.max(0, monthlyLimit - monthlyUsed)

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Assistant</h1>
          <p className="text-gray-500 text-sm mt-1">
            Describe changes to your site in plain English
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-700">
            {monthlyRemaining === null
              ? "Unlimited requests"
              : `${monthlyRemaining} requests remaining`}
          </p>
          <p className="text-xs text-gray-400">
            {TIER_LABELS[subscription.tier]} plan · resets monthly
          </p>
        </div>
      </div>

      {!site ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <p className="text-amber-800 font-medium">No site connected yet</p>
          <p className="text-amber-600 text-sm mt-1">
            Connect your client site to use the AI assistant.
          </p>
        </div>
      ) : (
        <AIChatInterface
          siteId={site.id}
          monthlyRemaining={monthlyRemaining}
        />
      )}
    </div>
  )
}
