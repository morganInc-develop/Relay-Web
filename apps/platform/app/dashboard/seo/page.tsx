import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { SubscriptionStatus } from "@prisma/client"
import SEOAuditPanel from "./SEOAuditPanel"

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

  const recentAudits = site
    ? await prisma.sEOAudit.findMany({
        where: { siteId: site.id },
        orderBy: { createdAt: "desc" },
        take: 5,
      })
    : []

  const tierLimits = {
    TIER1: { audits: 5, keywords: 3 },
    TIER2: { audits: 20, keywords: 10 },
    TIER3: { audits: null, keywords: null },
  }

  const limits = tierLimits[subscription.tier] ?? tierLimits.TIER1

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
        <SEOAuditPanel
          siteId={site.id}
          maxKeywords={limits.keywords ?? 999}
          recentAudits={recentAudits.map((audit) => ({
            id: audit.id,
            pageSlug: audit.page,
            overallScore: audit.score,
            createdAt: audit.createdAt,
          }))}
        />
      )}
    </div>
  )
}
