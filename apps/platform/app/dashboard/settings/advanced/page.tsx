import { redirect } from "next/navigation"
import { RiLockLine } from "react-icons/ri"

import PageHeader from "@/components/dashboard/PageHeader"
import ScriptManager from "@/components/site/ScriptManager"
import SitemapManager from "@/components/site/SitemapManager"
import WhitelabelSettings from "@/components/site/WhitelabelSettings"
import AnimatedPage from "@/components/ui/AnimatedPage"
import { auth } from "@/lib/auth"
import { hasTier3Access } from "@/lib/design-tier"
import { prisma } from "@/lib/prisma"

interface PayloadPagesResponse {
  docs?: Array<{
    slug?: string
    title?: string
  }>
}

export default async function AdvancedSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true, stripePriceId: true },
  })

  if (subscription?.status !== "ACTIVE") redirect("/onboarding")

  if (!hasTier3Access(subscription?.stripePriceId)) {
    return (
      <AnimatedPage className="rw-page-shell rw-page-shell--compact">
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

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, whitelabelUrl: true, payloadUrl: true },
  })

  if (!site) redirect("/onboarding")

  const [scripts, sitemapEntries] = await Promise.all([
    prisma.scriptInjection.findMany({
      where: { siteId: site.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.sitemapEntry.findMany({
      where: { siteId: site.id },
      orderBy: { pageSlug: "asc" },
    }),
  ])

  let availablePages: Array<{ slug: string; title: string }> = [{ slug: "home", title: "Home" }]

  if (site.payloadUrl) {
    try {
      const response = await fetch(`${site.payloadUrl}/api/pages?limit=20`, {
        cache: "no-store",
      })

      if (response.ok) {
        const data = (await response.json()) as PayloadPagesResponse
        if (Array.isArray(data.docs) && data.docs.length > 0) {
          const nextPages = data.docs
            .filter((doc) => typeof doc.slug === "string")
            .map((doc) => ({
              slug: doc.slug as string,
              title: typeof doc.title === "string" ? doc.title : (doc.slug as string),
            }))

          if (nextPages.length > 0) {
            availablePages = nextPages
          }
        }
      }
    } catch {
      // Fall back to the default page list if Payload is unavailable.
    }
  }

  return (
    <AnimatedPage className="rw-page-shell rw-page-shell--narrow space-y-8">
      <PageHeader
        title="Advanced Settings"
        description="Control custom scripts, white-label access, and sitemap behavior for the connected site."
      />

      <section className="rw-card p-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Script Injection</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Inject custom scripts into your site&apos;s &lt;head&gt; or &lt;body&gt;. Maximum 10
          scripts.
        </p>
        <div className="mt-6">
          <ScriptManager initialScripts={scripts} />
        </div>
      </section>

      <section className="rw-card p-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">White-Label Dashboard URL</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">Host this dashboard under your own domain.</p>
        <div className="mt-6">
          <WhitelabelSettings initialUrl={site.whitelabelUrl} />
        </div>
      </section>

      <section className="rw-card p-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Sitemap Management</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Control which pages appear in your sitemap and tune their crawl hints.
        </p>
        <div className="mt-6">
          <SitemapManager
            initialEntries={sitemapEntries.map((entry) => ({
              pageSlug: entry.pageSlug,
              include: entry.include,
              priority: entry.priority,
              changefreq: entry.changefreq,
            }))}
            availablePages={availablePages}
          />
        </div>
      </section>
    </AnimatedPage>
  )
}
