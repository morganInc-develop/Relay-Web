import { auth } from "@/lib/auth"
import { hasTier3Access } from "@/lib/design-tier"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { RiCheckboxCircleLine, RiLockLine } from "react-icons/ri"

import PageHeader from "@/components/dashboard/PageHeader"
import AnimatedPage from "@/components/ui/AnimatedPage"
import DomainVerification from "@/components/domain/DomainVerification"
import SiteLinking from "@/components/site/SiteLinking"
import ScriptManager from "@/components/site/ScriptManager"
import WhitelabelSettings from "@/components/site/WhitelabelSettings"

export default async function SitePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true, tier: true, stripePriceId: true },
  })
  if (!subscription || subscription.status !== "ACTIVE") redirect("/onboarding")

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    select: {
      id: true,
      domain: true,
      name: true,
      domainVerified: true,
      verifiedAt: true,
      verifyToken: true,
      repoUrl: true,
      payloadUrl: true,
      vercelProjectId: true,
      r2Prefix: true,
      status: true,
      whitelabelUrl: true,
    },
  })

  const scripts = site
    ? await prisma.scriptInjection.findMany({
        where: { siteId: site.id },
        orderBy: { createdAt: "desc" },
      })
    : []

  const canUseAdvancedSiteControls =
    subscription.tier === "TIER3" || hasTier3Access(subscription.stripePriceId)

  return (
    <AnimatedPage className="rw-page-shell rw-page-shell--compact space-y-10">
      <PageHeader
        title="Your Site"
        description="Verify ownership, connect infrastructure, and unlock live editing for your client workspace."
      />

      {/* Step 1 — Domain Verification */}
      <div className="rw-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
              site?.domainVerified
                ? "bg-[var(--success-bg)] text-[var(--success)]"
                : "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
            }`}
          >
            {site?.domainVerified ? <RiCheckboxCircleLine className="h-5 w-5" /> : "1"}
          </div>
          <div>
            <h2 className="font-semibold text-[var(--text-primary)]">Verify your domain</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Prove you own the domain by adding a DNS TXT record
            </p>
          </div>
        </div>

        {site?.domainVerified ? (
          <div className="flex items-center gap-2 rounded-lg border border-[color:rgba(34,197,94,0.25)] bg-[var(--success-bg)] px-4 py-3 text-[var(--success)]">
            <RiCheckboxCircleLine className="h-4 w-4" />
            <span className="text-sm font-medium">
              {site.domain} verified on{" "}
              {site.verifiedAt
                ? new Date(site.verifiedAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : ""}
            </span>
          </div>
        ) : (
          <DomainVerification />
        )}
      </div>

      {/* Step 2 — Site Linking */}
      <div
        className={`rw-card p-6 ${
          site?.domainVerified
            ? ""
            : "pointer-events-none opacity-55"
        }`}
      >
        <div className="mb-4 flex items-center gap-3">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
              site?.repoUrl && site?.payloadUrl
                ? "bg-[var(--success-bg)] text-[var(--success)]"
                : "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
            }`}
          >
            {site?.repoUrl && site?.payloadUrl ? (
              <RiCheckboxCircleLine className="h-5 w-5" />
            ) : (
              "2"
            )}
          </div>
          <div>
            <h2 className="font-semibold text-[var(--text-primary)]">Link your site</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Connect your GitHub repo, Payload CMS instance, and Neon database
            </p>
          </div>
        </div>

        {!site?.domainVerified ? (
          <p className="text-sm text-[var(--text-muted)]">
            Complete domain verification above to unlock this step.
          </p>
        ) : (
          <SiteLinking />
        )}
      </div>

      {/* Step 3 — Ready */}
      {site?.domainVerified && site?.repoUrl && site?.payloadUrl && (
        <div className="rounded-xl border border-[color:rgba(34,197,94,0.25)] bg-[var(--success-bg)] p-6 text-center">
          <RiCheckboxCircleLine className="mx-auto mb-3 h-10 w-10 text-[var(--success)]" />
          <h2 className="text-lg font-bold text-[var(--success)]">Your site is connected</h2>
          <p className="mb-4 mt-1 text-sm text-[var(--success)]">
            You can now start editing content from the dashboard.
          </p>
          <a
            href="/dashboard"
            className="rw-btn rw-btn-primary"
          >
            Go to dashboard
          </a>
        </div>
      )}

      {site ? (
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Site Controls</h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
              Manage Pro-level script injection and white-label dashboard access for this connected site.
            </p>
          </div>

          {canUseAdvancedSiteControls ? (
            <>
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Script Injection</h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Add approved scripts to your site&apos;s head or body without changing code.
                </p>
                <div className="mt-6">
                  <ScriptManager initialScripts={scripts} />
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">White-Label Dashboard URL</h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Host this dashboard under your own client-facing domain.
                </p>
                <div className="mt-6">
                  <WhitelabelSettings initialUrl={site.whitelabelUrl} />
                </div>
              </div>
            </>
          ) : (
            <div className="rw-card border-dashed p-8 text-center">
              <RiLockLine className="mx-auto mb-4 h-10 w-10 text-[var(--text-muted)]" />
              <h2 className="mb-2 text-2xl font-bold text-[var(--text-primary)]">
                Site Controls Locked
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Upgrade to Tier 3 (Pro) to unlock script injection and white-label dashboard controls.
              </p>
            </div>
          )}
        </section>
      ) : null}
    </AnimatedPage>
  )
}
