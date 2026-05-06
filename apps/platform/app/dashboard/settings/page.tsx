import { redirect } from "next/navigation"
import Link from "next/link"
import { RiBankCardLine, RiGlobalLine, RiSearchLine, RiSettings3Line } from "react-icons/ri"

import PageHeader from "@/components/dashboard/PageHeader"
import AnimatedPage from "@/components/ui/AnimatedPage"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true, tier: true },
  })

  if (subscription?.status !== "ACTIVE") redirect("/onboarding")

  const cards = [
    {
      title: "Billing",
      description: "Review plan status, renewal timing, and payment controls.",
      href: "/dashboard/settings/billing",
      icon: RiBankCardLine,
    },
    {
      title: "Site Controls",
      description: "Manage domain setup, script injection, and white-label URL controls.",
      href: "/dashboard/site",
      icon: RiGlobalLine,
    },
    {
      title: "SEO Settings",
      description: "Edit metadata, structured data, and sitemap behavior.",
      href: "/dashboard/seo",
      icon: RiSearchLine,
    },
    {
      title: "Advanced",
      description: "Find Pro settings and their current dashboard locations.",
      href: "/dashboard/settings/advanced",
      icon: RiSettings3Line,
    },
  ]

  return (
    <AnimatedPage className="rw-page-shell rw-page-shell--narrow space-y-8">
      <PageHeader
        title="Settings"
        description={`Manage workspace settings for your ${subscription.tier.replace("TIER", "Tier ")} plan.`}
      />

      <section className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon

          return (
            <Link
              key={card.href}
              href={card.href}
              className="rw-card group flex min-h-36 flex-col justify-between p-5 transition hover:border-[var(--border-accent)]"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--accent-500)]">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">{card.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{card.description}</p>
                </div>
              </div>
              <span className="mt-4 text-sm font-medium text-[var(--accent-500)] group-hover:text-[var(--text-primary)]">
                Open
              </span>
            </Link>
          )
        })}
      </section>
    </AnimatedPage>
  )
}
