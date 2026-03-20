import SeoAudit from "@/components/seo/SeoAudit"
import StructuredDataSection from "@/components/seo/StructuredDataSection"
import { redirect } from "next/navigation"
import { RiLockLine } from "react-icons/ri"

import PageHeader from "@/components/dashboard/PageHeader"
import AnimatedPage from "@/components/ui/AnimatedPage"
import { auth } from "@/lib/auth"
import { hasTier3Access } from "@/lib/design-tier"
import { prisma } from "@/lib/prisma"

export default async function SeoPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true, tier: true, stripePriceId: true },
  })
  if (subscription?.status !== "ACTIVE") redirect("/onboarding")

  return (
    <AnimatedPage className="rw-page-shell rw-page-shell--narrow space-y-8">
      <PageHeader
        title="SEO Audit"
        description="Run AI-powered audits, review recommendations, and apply structured metadata without leaving the dashboard."
      />
      <SeoAudit tier={subscription?.tier ?? "TIER1"} />

      {hasTier3Access(subscription?.stripePriceId) ? (
        <StructuredDataSection />
      ) : (
        <section>
          <div className="rw-card border-dashed p-8 text-center">
            <RiLockLine className="mx-auto mb-4 h-10 w-10 text-[var(--text-muted)]" />
            <h2 className="mb-2 text-2xl font-bold text-[var(--text-primary)]">
              Structured Data Locked
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Upgrade to Tier 3 (Pro) to unlock structured data controls.
            </p>
          </div>
        </section>
      )}
    </AnimatedPage>
  )
}
