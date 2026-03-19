import { redirect } from "next/navigation"

import DomainVerification from "@/components/domain/DomainVerification"
import OnboardingCheckout from "@/components/onboarding/OnboardingCheckout"
import SiteLinking from "@/components/site/SiteLinking"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const plans = [
  {
    key: "starter" as const,
    name: "Starter",
    price: "$50/month",
    priceId: process.env.STRIPE_PRICE_STARTER ?? "",
    features: [
      "Text editing",
      "SEO meta tag editing",
      "5 SEO audit scans/month",
      "Analytics dashboard",
      "10 version history",
    ],
  },
  {
    key: "growth" as const,
    name: "Growth",
    price: "$100/month",
    priceId: process.env.STRIPE_PRICE_GROWTH ?? "",
    features: [
      "Everything in Starter",
      "Design controls",
      "AI SEO auto-fix",
      "AI chatbot (150 req/month)",
    ],
  },
  {
    key: "pro" as const,
    name: "Pro",
    price: "$200/month",
    priceId: process.env.STRIPE_PRICE_PRO ?? "",
    features: [
      "Everything in Growth",
      "AI component generation",
      "Unlimited AI requests",
      "Priority support",
    ],
  },
]

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const params = await searchParams
  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true },
  })

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      domainVerified: true,
      linked: true,
    },
  })

  const hasActiveSubscription = subscription?.status === "ACTIVE"
  const hasVerifiedDomain = Boolean(site?.domainVerified)
  const hasLinkedSite = Boolean(site?.linked)

  if (hasActiveSubscription && hasVerifiedDomain && hasLinkedSite) {
    redirect("/dashboard")
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 md:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Finish your onboarding</h1>
          <p className="mt-2 text-sm text-slate-600">
            Complete these steps once to unlock your dashboard.
          </p>
        </div>

        {!hasActiveSubscription ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <OnboardingCheckout plans={plans} sessionId={params.session_id} />
          </div>
        ) : !hasVerifiedDomain ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">Step 2: Verify your domain</h2>
            <p className="mt-1 text-sm text-slate-600">
              Add your verification meta tag, redeploy, then verify.
            </p>
            <div className="mt-5">
              <DomainVerification />
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">Step 3: Link your site</h2>
            <p className="mt-1 text-sm text-slate-600">
              Connect your repo, Payload instance, and client database.
            </p>
            <div className="mt-5">
              <SiteLinking />
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
