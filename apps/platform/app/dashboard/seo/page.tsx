import SeoAudit from "@/components/seo/SeoAudit"
import StructuredDataSection from "@/components/seo/StructuredDataSection"
import { redirect } from "next/navigation"

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
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">SEO Audit</h1>
      <p className="mb-8 text-sm text-gray-500">
        Run an AI-powered audit on any page. Get scored results and one-click auto-fix.
      </p>
      <SeoAudit tier={subscription?.tier ?? "TIER1"} />

      {hasTier3Access(subscription?.stripePriceId) ? (
        <StructuredDataSection />
      ) : (
        <section className="mt-12">
          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="mb-2 text-2xl font-bold text-slate-900">
              Structured Data Locked
            </h2>
            <p className="text-sm text-slate-600">
              Upgrade to Tier 3 (Pro) to unlock structured data controls.
            </p>
          </div>
        </section>
      )}
    </main>
  )
}
