"use client"

import { useEffect, useMemo, useState } from "react"

type Plan = {
  key: "starter" | "growth" | "pro"
  name: string
  price: string
  priceId: string
  features: string[]
}

type OnboardingCheckoutProps = {
  plans: Plan[]
  sessionId?: string
}

export default function OnboardingCheckout({ plans, sessionId }: OnboardingCheckoutProps) {
  const [startingPriceId, setStartingPriceId] = useState<string | null>(null)
  const [processingSession, setProcessingSession] = useState(Boolean(sessionId))
  const [error, setError] = useState<string | null>(null)

  const canStartCheckout = useMemo(() => plans.every((plan) => Boolean(plan.priceId)), [plans])

  useEffect(() => {
    if (!sessionId) return

    let cancelled = false
    let attempts = 0

    const pollSubscription = async () => {
      while (!cancelled && attempts < 30) {
        attempts += 1
        try {
          const res = await fetch("/api/stripe/subscription", { cache: "no-store" })
          const data = (await res.json()) as { subscription?: { status?: string } }

          if (res.ok && data.subscription?.status === "ACTIVE") {
            window.location.href = "/onboarding"
            return
          }
        } catch {
          // Keep polling; transient errors should not break onboarding.
        }

        await new Promise((resolve) => setTimeout(resolve, 2000))
      }

      if (!cancelled) {
        setProcessingSession(false)
      }
    }

    void pollSubscription()

    return () => {
      cancelled = true
    }
  }, [sessionId])

  const startCheckout = async (priceId: string) => {
    if (!priceId || !canStartCheckout) return

    setStartingPriceId(priceId)
    setError(null)

    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      })

      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Failed to start checkout")
      }

      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout")
      setStartingPriceId(null)
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Step 1: Choose a plan</h2>
      <p className="text-sm text-[var(--text-secondary)]">Start your subscription to continue onboarding.</p>

      {processingSession && (
        <div className="rounded-lg border border-[color:rgba(96,165,250,0.24)] bg-[color:rgba(59,130,246,0.12)] p-4 text-sm text-[var(--accent-500)]">
          Finalizing your checkout session. This may take a few seconds...
        </div>
      )}

      {!canStartCheckout && (
        <div className="rounded-lg border border-[color:rgba(239,68,68,0.28)] bg-[var(--error-bg)] p-4 text-sm text-[var(--error)]">
          Stripe price IDs are not configured. Set STRIPE_PRICE_STARTER, STRIPE_PRICE_GROWTH, and
          STRIPE_PRICE_PRO.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isLoading = startingPriceId === plan.priceId

          return (
            <article key={plan.key} className="rw-card-interactive rw-card h-full p-5">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">{plan.name}</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{plan.price}</p>

              <ul className="mt-4 space-y-2 text-xs text-[var(--text-secondary)]">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--accent-500)]" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => void startCheckout(plan.priceId)}
                disabled={Boolean(startingPriceId) || !plan.priceId || !canStartCheckout || processingSession}
                className="rw-btn rw-btn-primary mt-5 w-full"
              >
                {isLoading ? "Redirecting..." : "Select plan"}
              </button>
            </article>
          )
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-[color:rgba(239,68,68,0.28)] bg-[var(--error-bg)] p-4 text-sm text-[var(--error)]">{error}</div>
      )}
    </section>
  )
}
