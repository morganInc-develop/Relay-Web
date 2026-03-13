"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  userId: string;
  tierName: string;
}

export default function SuccessClient({ userId, tierName }: Props) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const timedOut = attempts >= 10;

  useEffect(() => {
    void userId;

    if (timedOut) {
      return;
    }

    const timer = setTimeout(async () => {
      const res = await fetch("/api/stripe/subscription");
      if (res.ok) {
        const data = (await res.json()) as {
          subscription?: { status?: string } | null;
        };
        if (data?.subscription?.status === "ACTIVE") {
          router.push("/dashboard");
          return;
        }
      }
      setAttempts((prev) => prev + 1);
    }, 3000);

    return () => clearTimeout(timer);
  }, [attempts, router, timedOut, userId]);

  if (timedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-lg">
          <h1 className="mb-3 text-xl font-bold text-gray-900">
            This is taking longer than expected
          </h1>
          <p className="mb-6 text-gray-500">
            Your payment was received but your subscription is still activating.
            Please contact us and we&apos;ll get this resolved immediately.
          </p>
          <a
            href="mailto:hello@morgandev.studio"
            className="inline-block rounded-lg bg-gray-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-gray-700"
          >
            Contact hello@morgandev.studio
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-lg">
        <div className="mb-6 flex justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
        </div>
        <h1 className="mb-2 text-xl font-bold text-gray-900">
          Activating your subscription...
        </h1>
        <p className="text-sm text-gray-400">
          Setting up your {tierName} plan. This usually takes a few seconds.
        </p>
      </div>
    </div>
  );
}
