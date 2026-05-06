import { redirect } from "next/navigation"
import Link from "next/link"
import { RiGlobalLine, RiLockLine, RiSearchLine } from "react-icons/ri"

import PageHeader from "@/components/dashboard/PageHeader"
import AnimatedPage from "@/components/ui/AnimatedPage"
import { auth } from "@/lib/auth"
import { hasTier3Access } from "@/lib/design-tier"
import { prisma } from "@/lib/prisma"

export default async function AdvancedSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true, tier: true, stripePriceId: true },
  })

  if (subscription?.status !== "ACTIVE") redirect("/onboarding")

  const canUseAdvancedSettings =
    subscription?.tier === "TIER3" || hasTier3Access(subscription?.stripePriceId)

  if (!canUseAdvancedSettings) {
    return (
      <AnimatedPage className="rw-page-shell rw-page-shell--compact space-y-8">
        <PageHeader
          title="Advanced Settings"
          description="Pro controls for scripts, white-label access, sitemap rules, and structured data."
        />
        <div className="rw-card border-dashed p-8 text-center">
          <RiLockLine className="mx-auto mb-4 h-10 w-10 text-[var(--text-muted)]" />
          <h1 className="mb-2 text-2xl font-bold text-[var(--text-primary)]">Advanced Settings Locked</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Upgrade to Tier 3 (Pro) to unlock advanced settings
          </p>
        </div>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage className="rw-page-shell rw-page-shell--narrow space-y-8">
      <PageHeader
        title="Advanced Settings"
        description="Pro controls are now grouped with the dashboard area they affect."
      />

      <section className="grid gap-4 md:grid-cols-2">
        <Link href="/dashboard/site" className="rw-card group p-5 transition hover:border-[var(--border-accent)]">
          <RiGlobalLine className="mb-4 h-8 w-8 text-[var(--accent-500)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Site Controls</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            Script injection and white-label dashboard URL controls live with domain and site setup.
          </p>
          <span className="mt-5 inline-block text-sm font-medium text-[var(--accent-500)] group-hover:text-[var(--text-primary)]">
            Open site controls
          </span>
        </Link>

        <Link href="/dashboard/seo" className="rw-card group p-5 transition hover:border-[var(--border-accent)]">
          <RiSearchLine className="mb-4 h-8 w-8 text-[var(--accent-500)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">SEO Controls</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            Sitemap management and structured data controls live with SEO fields and audits.
          </p>
          <span className="mt-5 inline-block text-sm font-medium text-[var(--accent-500)] group-hover:text-[var(--text-primary)]">
            Open SEO controls
          </span>
        </Link>
      </section>
    </AnimatedPage>
  )
}
