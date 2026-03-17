import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { SubscriptionStatus, SubscriptionTier } from "@prisma/client"
import SeoAudit from "@/components/seo/SeoAudit"

export default async function SEOPage() {
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

  const tierLimits = {
    [SubscriptionTier.TIER1]: { audits: 5, keywords: 3, canAutoFix: false },
    [SubscriptionTier.TIER2]: { audits: 20, keywords: 10, canAutoFix: true },
    [SubscriptionTier.TIER3]: { audits: null, keywords: 999, canAutoFix: true },
  }

  const limits = tierLimits[subscription.tier] ?? tierLimits[SubscriptionTier.TIER1]

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">SEO Audit</h1>
        <p className="text-gray-500 text-sm mt-1">
          {limits.audits
            ? `${limits.audits} audits/month · ${limits.keywords} keywords per scan`
            : "Unlimited audits and keywords"}
        </p>
      </div>
      {!site ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <p className="text-amber-800 font-medium">No site connected yet</p>
        </div>
      ) : (
        <SeoAudit maxKeywords={limits.keywords} canAutoFix={limits.canAutoFix} />
      )}
    </div>
  )
}
