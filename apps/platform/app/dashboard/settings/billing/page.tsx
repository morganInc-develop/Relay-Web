import { SubscriptionStatus } from "@prisma/client";
import { redirect } from "next/navigation";

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
    className: "bg-slate-100 text-slate-700",
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
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Billing &amp; Subscription</h1>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">Current plan</p>
            <div className="mt-2 flex items-center gap-3">
              <h2 className="text-2xl font-semibold text-slate-900">{tierName}</h2>
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                {tierName}
              </span>
            </div>
            <p className="mt-2 text-lg text-slate-700">{tierPrice}/month</p>
          </div>
          <span
            className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusBadge.className}`}
          >
            {statusBadge.label}
          </span>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="text-sm text-slate-600">Billing period: Renews on {renewalDate}</p>
        </div>

        {cancelAtPeriodEnd ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your plan will cancel on {renewalDate}. Reactivate anytime to keep access.
          </div>
        ) : null}

        {isPastDue ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Your last payment failed. Update your payment method to keep access.
          </div>
        ) : null}

        <div className="mt-6">
          <ManageBillingButton />
        </div>
      </section>
    </div>
  );
}
