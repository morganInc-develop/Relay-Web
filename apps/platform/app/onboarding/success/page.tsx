import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

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
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-lg">
          <div className="mb-6 flex justify-center">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <h1 className="mb-3 text-3xl font-bold text-gray-900">You&apos;re all set!</h1>
          <p className="mb-2 text-lg text-gray-500">
            Your <span className="font-semibold text-gray-800">{tierName}</span> plan is now
            active.
          </p>
          <p className="mb-8 text-sm text-gray-400">
            You now have full access to your RelayWeb dashboard.
          </p>
          <Link
            href="/dashboard"
            className="inline-block rounded-lg bg-gray-900 px-8 py-3 font-semibold text-white transition-colors hover:bg-gray-700"
          >
            Go to dashboard →
          </Link>
        </div>
      </div>
    );
  }

  return <SuccessClient userId={session.user.id} tierName={tierName} />;
}
