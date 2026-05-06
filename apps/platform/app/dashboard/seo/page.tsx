import SeoAudit from "@/components/seo/SeoAudit"
import StructuredDataSection from "@/components/seo/StructuredDataSection"
import { redirect } from "next/navigation"

import ContentEditor from "@/app/dashboard/content/ContentEditor"
import PageHeader from "@/components/dashboard/PageHeader"
import SitemapManager from "@/components/site/SitemapManager"
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

export default async function SeoPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true, tier: true, stripePriceId: true },
  })
  if (subscription?.status !== "ACTIVE") redirect("/onboarding")

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, payloadUrl: true },
  })

  if (!site) redirect("/onboarding")

  const sitemapEntries = await prisma.sitemapEntry.findMany({
    where: { siteId: site.id },
    orderBy: { pageSlug: "asc" },
  })

  let availablePages: Array<{ slug: string; title: string }> = [{ slug: "home", title: "Home" }]

  if (site.payloadUrl) {
    try {
      const response = await fetch(`${site.payloadUrl}/api/pages?limit=20`, {
        cache: "no-store",
      })

      if (response.ok) {
        const data = (await response.json()) as PayloadPagesResponse
        const nextPages = data.docs
          ?.filter((doc) => typeof doc.slug === "string")
          .map((doc) => ({
            slug: doc.slug as string,
            title: typeof doc.title === "string" ? doc.title : (doc.slug as string),
          }))

        if (nextPages?.length) {
          availablePages = nextPages
        }
      }
    } catch {
      // Keep the default page list if the connected Payload site is unavailable.
    }
  }

  const hasStructuredDataAccess =
    subscription?.tier === "TIER3" || hasTier3Access(subscription?.stripePriceId)

  return (
    <AnimatedPage className="rw-page-shell rw-page-shell--narrow space-y-8">
      <PageHeader
        title="SEO"
        description="Edit metadata, run AI-powered audits, manage sitemap rules, and apply structured data when available."
      />

      <section className="rw-card p-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">SEO Fields</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Manage meta title, meta description, Open Graph title, and Open Graph description by page.
        </p>
        <div className="mt-6">
          <ContentEditor siteId={site.id} mode="seo" />
        </div>
      </section>

      <SeoAudit tier={subscription?.tier ?? "TIER1"} />

      {hasStructuredDataAccess ? (
        <>
          <section className="rw-card p-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Sitemap Management</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Control which pages appear in your sitemap and tune crawl hints.
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
          <StructuredDataSection />
        </>
      ) : null}
    </AnimatedPage>
  )
}
