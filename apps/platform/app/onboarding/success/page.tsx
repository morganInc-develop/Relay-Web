import Link from "next/link";
import { redirect } from "next/navigation";
import { RiCheckboxCircleLine } from "react-icons/ri";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

import SuccessClient from "./SuccessClient";

const tierNames: Record<string, string> = {
  TIER1: "Starter",
  TIER2: "Growth",
  TIER3: "Pro",
};

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const params = await searchParams;
  const sessionId = params.session_id;
  if (!sessionId) redirect("/onboarding");

  try {
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
    if (checkoutSession.payment_status !== "paid") redirect("/onboarding");
  } catch {
    // Allow local verification and polling fallback when session lookup fails.
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  });

  const tierName = subscription?.tier
    ? tierNames[subscription.tier] ?? "Starter"
    : "Starter";

  if (subscription?.status === "ACTIVE") {
    return (
      <div className="rw-standalone-shell flex min-h-screen items-center justify-center p-4">
        <div className="rw-card-elevated w-full max-w-md p-10 text-center">
          <div className="mb-6 flex justify-center">
            <RiCheckboxCircleLine className="h-16 w-16 text-[var(--success)]" />
          </div>
          <h1 className="mb-3 text-3xl font-bold text-[var(--text-primary)]">You&apos;re all set!</h1>
          <p className="mb-2 text-lg text-[var(--text-secondary)]">
            Your <span className="font-semibold text-[var(--text-primary)]">{tierName}</span> plan is now
            active.
          </p>
          <p className="mb-8 text-sm text-[var(--text-muted)]">
            You now have full access to your RelayWeb dashboard.
          </p>
          <Link
            href="/dashboard"
            className="rw-btn rw-btn-primary"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <SuccessClient userId={session.user.id} tierName={tierName} />;
}
