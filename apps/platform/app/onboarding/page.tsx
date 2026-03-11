import Link from "next/link";

import { auth } from "@/lib/auth";

const pricingTiers = [
  {
    name: "Starter",
    price: "$50/month",
    href: "/onboarding/checkout?tier=1",
    features: [
      "Text editing",
      "SEO meta tag editing",
      "5 SEO audit scans/month",
      "Analytics dashboard",
      "Staging & scheduling",
      "10 version history",
      "AI chatbot (50 req/month)",
    ],
  },
  {
    name: "Growth",
    price: "$100/month",
    href: "/onboarding/checkout?tier=2",
    mostPopular: true,
    features: [
      "Everything in Starter",
      "Color, font & layout controls",
      "Component swapping",
      "AI SEO auto-fix",
      "AI chatbot (150 req/month)",
    ],
  },
  {
    name: "Pro",
    price: "$200/month",
    href: "/onboarding/checkout?tier=3",
    features: [
      "Everything in Growth",
      "AI component generation",
      "Custom script injection",
      "Shadcn component builder",
      "Unlimited AI requests",
      "30 version history",
      "Monthly AI site report",
      "White-label dashboard URL",
      "Priority support",
    ],
  },
];

export default async function OnboardingPage() {
  console.log("[onboarding] rendering page, calling auth()");
  const session = await auth();
  console.log("[onboarding] auth() result — userId:", session?.user?.id ?? "none (guest)");

  const name = session?.user?.name ?? session?.user?.email ?? null;
  console.log("[onboarding] rendering pricing — user:", name ?? "guest");

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center md:mb-12">
          {name ? (
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              Welcome, {name}
            </p>
          ) : null}
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 md:text-4xl">
            Choose your plan to get started
          </h1>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {pricingTiers.map((tier) => (
            <article
              key={tier.name}
              className={`relative rounded-2xl border bg-white p-6 shadow-sm ${
                tier.mostPopular
                  ? "border-slate-900 ring-2 ring-slate-900/10"
                  : "border-slate-200"
              }`}
            >
              {tier.mostPopular ? (
                <span className="absolute -top-3 right-4 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                  Most Popular
                </span>
              ) : null}

              <h2 className="text-xl font-semibold text-slate-900">{tier.name}</h2>
              <p className="mt-1 text-sm text-slate-600">{tier.price}</p>

              <ul className="mt-6 space-y-3 text-sm text-slate-700">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={tier.href}
                className={`mt-8 inline-flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold transition ${
                  tier.mostPopular
                    ? "bg-slate-900 text-white hover:bg-slate-800"
                    : "bg-slate-100 text-slate-900 hover:bg-slate-200"
                }`}
              >
                Get started
              </Link>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
