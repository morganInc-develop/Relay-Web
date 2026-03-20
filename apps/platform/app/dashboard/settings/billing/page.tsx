import { SubscriptionStatus } from "@prisma/client";
import { redirect } from "next/navigation";

import PageHeader from "@/components/dashboard/PageHeader";
import AnimatedPage from "@/components/ui/AnimatedPage";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import ManageBillingButton from "./ManageBillingButton";

const tierNames: Record<string, string> = {
  TIER1: "Starter",
  TIER2: "Growth",
  TIER3: "Pro",
};

const tierPrices: Record<string, string> = {
  TIER1: "$50",
  TIER2: "$100",
  TIER3: "$200",
};

function formatDate(date: Date | null | undefined) {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusBadge(status: SubscriptionStatus) {
  if (status === SubscriptionStatus.ACTIVE) {
    return {
      label: "Active",
      className: "bg-green-100 text-green-700",
    };
  }
  if (status === SubscriptionStatus.PAST_DUE) {
    return {
      label: "Past Due",
      className: "bg-yellow-100 text-yellow-800",
    };
  }
  if (status === SubscriptionStatus.CANCELLED) {
    return {
      label: "Cancelled",
      className: "bg-red-100 text-red-700",
    };
  }

  return {
    label: "Inactive",
    className: "bg-[var(--bg-elevated)] text-[var(--text-secondary)]",
  };
}

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  });

  const isPastDue = subscription?.status === SubscriptionStatus.PAST_DUE;
  const cancelAtPeriodEnd = subscription?.cancelAtPeriodEnd ?? false;

  if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
    redirect("/onboarding");
  }

  const tierName = tierNames[subscription.tier] ?? "Starter";
  const tierPrice = tierPrices[subscription.tier] ?? "$50";
  const statusBadge = getStatusBadge(subscription.status);
  const renewalDate = formatDate(subscription.currentPeriodEnd);

  return (
    <AnimatedPage className="rw-page-shell rw-page-shell--narrow space-y-8">
      <PageHeader
        title="Billing & Subscription"
        description="Review your active plan, billing status, renewal timing, and payment controls."
      />

      <section className="rw-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-[var(--text-muted)]">Current plan</p>
            <div className="mt-2 flex items-center gap-3">
              <h2 className="text-2xl font-semibold text-[var(--text-primary)]">{tierName}</h2>
              <span className="rw-badge">
                {tierName}
              </span>
            </div>
            <p className="mt-2 text-lg text-[var(--text-secondary)]">{tierPrice}/month</p>
          </div>
          <span
            className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusBadge.className}`}
          >
            {statusBadge.label}
          </span>
        </div>

        <div className="mt-6 border-t border-[var(--border-subtle)] pt-4">
          <p className="text-sm text-[var(--text-secondary)]">Billing period: Renews on {renewalDate}</p>
        </div>

        {cancelAtPeriodEnd ? (
          <div className="mt-4 rounded-lg border border-[color:rgba(245,158,11,0.28)] bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning)]">
            Your plan will cancel on {renewalDate}. Reactivate anytime to keep access.
          </div>
        ) : null}

        {isPastDue ? (
          <div className="mt-4 rounded-lg border border-[color:rgba(239,68,68,0.28)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error)]">
            Your last payment failed. Update your payment method to keep access.
          </div>
        ) : null}

        <div className="mt-6">
          <ManageBillingButton />
        </div>
      </section>
    </AnimatedPage>
  );
}
