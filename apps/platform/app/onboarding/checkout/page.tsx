"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

import StandaloneShell from "@/components/ui/StandaloneShell";

function LoadingFallback() {
  return (
    <StandaloneShell maxWidth="sm">
      <div className="text-center">
        <span className="rw-eyebrow justify-center">Relay Web</span>
        <div className="mt-8 flex justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--border-default)] border-t-[var(--accent-500)]" />
        </div>
        <p className="mt-6 text-lg font-semibold text-[var(--text-primary)]">
          Setting up your checkout...
        </p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          You&apos;ll be redirected to Stripe in a moment.
        </p>
      </div>
    </StandaloneShell>
  );
}

function CheckoutPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasStartedRef = useRef(false);

  const tier = searchParams.get("tier");
  const isValidTier = tier === "1" || tier === "2" || tier === "3";
  const priceId = useMemo(() => {
    const byTier: Record<string, string | undefined> = {
      "1": process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER ?? process.env.STRIPE_PRICE_STARTER,
      "2": process.env.NEXT_PUBLIC_STRIPE_PRICE_GROWTH ?? process.env.STRIPE_PRICE_GROWTH,
      "3": process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? process.env.STRIPE_PRICE_PRO,
    };

    return tier ? byTier[tier] : undefined;
  }, [tier]);

  useEffect(() => {
    if (hasStartedRef.current) return;

    if (!isValidTier) {
      hasStartedRef.current = true;
      router.replace("/onboarding");
      return;
    }

    if (status === "unauthenticated") {
      hasStartedRef.current = true;
      router.replace("/auth/signin");
      return;
    }

    if (status !== "authenticated") {
      return;
    }

    hasStartedRef.current = true;

    const startCheckout = async () => {
      setIsLoading(true);

      if (!priceId) {
        setError("Missing Stripe price configuration");
        setIsLoading(false);
        return;
      }

      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Failed to start checkout");
        setIsLoading(false);
        return;
      }

      const data = (await res.json()) as { url?: string };
      if (!data.url) {
        setError("Failed to start checkout");
        setIsLoading(false);
        return;
      }

      window.location.href = data.url;
    };

    startCheckout().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to start checkout");
      setIsLoading(false);
    });
  }, [isValidTier, priceId, router, status, tier]);

  if (error) {
    return (
      <StandaloneShell maxWidth="sm">
        <div className="text-center">
          <span className="rw-eyebrow justify-center">Relay Web</span>
          <h1 className="mt-5 text-xl font-semibold text-[var(--text-primary)]">
            Checkout setup failed
          </h1>
          <p className="mt-3 rounded-xl border border-[color:rgba(239,68,68,0.28)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error)]">
            {error}
          </p>
          <button
            type="button"
            onClick={() => router.push("/onboarding")}
            className="rw-btn rw-btn-primary mt-6"
          >
            Go back
          </button>
        </div>
      </StandaloneShell>
    );
  }

  if (isLoading) {
    return (
      <LoadingFallback />
    );
  }

  return null;
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CheckoutPageInner />
    </Suspense>
  );
}
