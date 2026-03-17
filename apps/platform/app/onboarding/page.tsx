import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

// Debug: server-side env + auth checks
console.log("[onboarding] rendering onboarding/pricing page");
console.log("[onboarding] NODE_ENV:", process.env.NODE_ENV);
console.log("[onboarding] AUTH_SECRET present:", !!process.env.AUTH_SECRET);
console.log("[onboarding] NEXTAUTH_SECRET present:", !!process.env.NEXTAUTH_SECRET);
console.log("[onboarding] AUTH_URL:", process.env.AUTH_URL ?? "(not set)");
console.log("[onboarding] NEXTAUTH_URL:", process.env.NEXTAUTH_URL ?? "(not set)");
console.log("[onboarding] GOOGLE_CLIENT_ID present:", !!process.env.GOOGLE_CLIENT_ID);
console.log("[onboarding] DATABASE_URL present:", !!process.env.DATABASE_URL);
console.log("[onboarding] DIRECT_URL present:", !!process.env.DIRECT_URL);

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
  let session = null;
  let authError: string | null = null;

  try {
    session = await auth();
    console.log("[onboarding] auth() resolved — userId:", session?.user?.id ?? "null");
    console.log("[onboarding] auth() user email:", session?.user?.email ?? "null");
  } catch (err) {
    authError = err instanceof Error ? err.message : String(err);
    console.error("[onboarding] auth() threw an error:", authError);
  }

  if (!session?.user?.id) {
    console.log("[onboarding] no session, redirecting to /auth/signin");
    redirect("/auth/signin");
  }

  const name = session?.user?.name ?? session?.user?.email ?? null;
  const debugInfo = {
    NODE_ENV: process.env.NODE_ENV ?? "(not set)",
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL ?? "(not set)",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "(not set)",
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    DATABASE_URL: !!process.env.DATABASE_URL,
    DIRECT_URL: !!process.env.DIRECT_URL,
    sessionUserId: session?.user?.id ?? "null",
    sessionEmail: session?.user?.email ?? "null",
    authError: authError ?? "none",
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* DEBUG PANEL */}
        <details className="rounded-xl border-2 border-yellow-400 bg-yellow-50 p-4 text-xs">
          <summary className="cursor-pointer font-bold text-yellow-800">
            🐛 DEBUG — Onboarding/Pricing Page (click to expand)
          </summary>
          <table className="mt-3 w-full border-collapse font-mono">
            <tbody>
              {Object.entries(debugInfo).map(([key, val]) => (
                <tr key={key} className="border-t border-yellow-200">
                  <td className="py-1 pr-4 text-slate-600">{key}</td>
                  <td
                    className={`py-1 ${
                      val === false || val === "(not set)" || val === "null"
                        ? "font-bold text-red-600"
                        : key === "authError" && val !== "none"
                          ? "font-bold text-red-600"
                          : "text-green-700"
                    }`}
                  >
                    {typeof val === "boolean" ? (val ? "✅ present" : "❌ MISSING") : String(val)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>

        {/* Original page content */}
        <div>
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
    </div>
  );
}
