"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          RelayWeb
        </p>
        <div className="mt-8 flex justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
        </div>
        <p className="mt-6 text-lg font-semibold text-slate-900">
          Setting up your checkout...
        </p>
        <p className="mt-2 text-sm text-slate-500">
          You&apos;ll be redirected to Stripe in a moment
        </p>
      </div>
    </div>
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

      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: parseInt(tier, 10) }),
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
  }, [isValidTier, router, status, tier]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            RelayWeb
          </p>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">
            Checkout setup failed
          </h1>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => router.push("/onboarding")}
            className="mt-6 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="w-full max-w-md text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            RelayWeb
          </p>
          <div className="mt-8 flex justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
          </div>
          <p className="mt-6 text-lg font-semibold text-slate-900">
            Setting up your checkout...
          </p>
          <p className="mt-2 text-sm text-slate-500">
            You&apos;ll be redirected to Stripe in a moment
          </p>
        </div>
      </div>
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
