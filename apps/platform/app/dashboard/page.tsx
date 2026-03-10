import Link from "next/link";
import { SubscriptionStatus, type SubscriptionTier } from "@prisma/client";
import { redirect } from "next/navigation";

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
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Welcome back, {name}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Keep your website updated and performing at its best.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            {planLabels[subscription.tier]}
          </span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">Pages</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{pageCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">Last updated</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {formatDate(site?.updatedAt)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">AI requests remaining this month</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {aiRequestsRemaining}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Quick actions</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/dashboard/content"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Edit Content
          </Link>
          <Link
            href="/dashboard/seo"
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-200"
          >
            Run SEO Audit
          </Link>
          <Link
            href="/dashboard/analytics"
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-200"
          >
            View Analytics
          </Link>
        </div>
      </section>

      {!site ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Connect your site</h2>
          <p className="mt-2 text-sm text-slate-600">
            Your dashboard is ready. Connect your first website to unlock content,
            SEO, analytics, and AI actions.
          </p>
          <Link
            href="/settings"
            className="mt-6 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Connect your site
          </Link>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent activity</h2>
            <p className="text-sm text-slate-500">{site.name}</p>
          </div>

          {recentActivity.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              No recent version snapshots yet.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {recentActivity.map((activity) => (
                <li
                  key={activity.id}
                  className="flex flex-col gap-1 py-3 text-sm md:flex-row md:items-center md:justify-between"
                >
                  <p className="text-slate-700">
                    <span className="font-medium text-slate-900">{activity.page}</span>
                    {" • "}
                    <span>{activity.field}</span>
                  </p>
                  <p className="text-slate-500">
                    {activity.source} • {formatDate(activity.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
