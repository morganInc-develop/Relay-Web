import Link from "next/link";
import { SubscriptionStatus, type SubscriptionTier } from "@prisma/client";
import { redirect } from "next/navigation";
import { RiGlobalLine } from "react-icons/ri";

import PageHeader from "@/components/dashboard/PageHeader";
import AnimatedPage from "@/components/ui/AnimatedPage";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const planLabels: Record<SubscriptionTier, string> = {
  TIER1: "Starter",
  TIER2: "Growth",
  TIER3: "Pro",
};

function formatDate(value: Date | null | undefined) {
  if (!value) return "N/A";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function getMonthlyLimit(tier: SubscriptionTier): number | null {
  if (tier === "TIER1") return 50;
  if (tier === "TIER2") return 150;
  return null;
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { tier: true, status: true },
  });

  if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
    redirect("/onboarding");
  }

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      domain: true,
      updatedAt: true,
      _count: {
        select: {
          contentFields: true,
        },
      },
    },
  });

  let recentActivity: Array<{
    id: string;
    page: string;
    field: string;
    source: string;
    createdAt: Date;
  }> = [];
  let pageCount = 0;
  let aiRequestsRemaining: string | number = "Unlimited";

  if (site) {
    const [distinctPages, snapshots] = await Promise.all([
      prisma.contentField.findMany({
        where: { siteId: site.id },
        select: { page: true },
        distinct: ["page"],
      }),
      prisma.versionSnapshot.findMany({
        where: { siteId: site.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          page: true,
          field: true,
          source: true,
          createdAt: true,
        },
      }),
    ]);

    recentActivity = snapshots.map((snapshot) => ({
      ...snapshot,
      source: snapshot.source.replaceAll("_", " "),
    }));
    pageCount = distinctPages.length;
  }

  if (subscription.tier === "TIER3") {
    aiRequestsRemaining = "Unlimited";
  } else {
    const tierLimit = getMonthlyLimit(subscription.tier) ?? 0;

    if (!site) {
      aiRequestsRemaining = tierLimit;
    } else {
      const usage = await prisma.aIUsage.findUnique({
        where: { siteId: site.id },
        select: { chatRequests: true },
      });

      const used = usage?.chatRequests ?? 0;
      aiRequestsRemaining = Math.max(tierLimit - used, 0);
    }
  }

  const name = session.user.name ?? session.user.email ?? "there";

  return (
    <AnimatedPage className="rw-page-shell space-y-8">
      <PageHeader
        title={`Welcome back, ${name}`}
        description="Keep your website updated, optimized, and moving with a single control surface."
      />

      <section className="rw-card-elevated p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="rw-kicker">Active Plan</p>
            <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
              {planLabels[subscription.tier]}
            </p>
          </div>
          <span className="rw-badge">
            Relay Web workspace
          </span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rw-card p-5">
          <p className="text-sm text-[var(--text-secondary)]">Pages</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{pageCount}</p>
        </div>
        <div className="rw-card p-5">
          <p className="text-sm text-[var(--text-secondary)]">Last updated</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
            {formatDate(site?.updatedAt)}
          </p>
        </div>
        <div className="rw-card p-5">
          <p className="text-sm text-[var(--text-secondary)]">AI requests remaining this month</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
            {aiRequestsRemaining}
          </p>
        </div>
      </section>

      <section className="rw-card p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Quick actions</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/dashboard/content"
            className="rw-btn rw-btn-primary"
          >
            Edit Content
          </Link>
          <Link
            href="/dashboard/seo"
            className="rw-btn rw-btn-secondary"
          >
            Run SEO Audit
          </Link>
          <Link
            href="/dashboard/analytics"
            className="rw-btn rw-btn-secondary"
          >
            View Analytics
          </Link>
        </div>
      </section>

      {!site ? (
        <div className="rw-card border-dashed p-8 text-center">
          <RiGlobalLine className="mx-auto mb-3 h-10 w-10 text-[var(--text-muted)]" />
          <h3 className="mb-1 font-semibold text-[var(--text-primary)]">Connect your site</h3>
          <p className="mb-4 text-sm text-[var(--text-secondary)]">
            Verify your domain and link your site to start editing content.
          </p>
          <a
            href="/dashboard/site"
            className="rw-btn rw-btn-primary"
          >
            Connect site
          </a>
        </div>
      ) : (
        <section className="rw-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Recent activity</h2>
            <p className="text-sm text-[var(--text-secondary)]">{site.name}</p>
          </div>

          {recentActivity.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">
              No recent version snapshots yet.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--border-subtle)]">
              {recentActivity.map((activity) => (
                <li
                  key={activity.id}
                  className="flex flex-col gap-1 py-3 text-sm md:flex-row md:items-center md:justify-between"
                >
                  <p className="text-[var(--text-secondary)]">
                    <span className="font-medium text-[var(--text-primary)]">{activity.page}</span>
                    {" • "}
                    <span>{activity.field}</span>
                  </p>
                  <p className="text-[var(--text-muted)]">
                    {activity.source} • {formatDate(activity.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </AnimatedPage>
  );
}
