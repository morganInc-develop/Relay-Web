"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { RiShieldCheckLine } from "react-icons/ri";

import StandaloneShell from "@/components/ui/StandaloneShell";

function GoogleLogo() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.2-1.4 3.6-5.5 3.6-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.8H12Z"
      />
      <path
        fill="#34A853"
        d="M2 12c0 2.1.8 4 2.1 5.4l3.4-2.7C6.7 14 6.3 13 6.3 12c0-1 .4-2 1.2-2.7L4.1 6.6C2.8 8 2 9.9 2 12Z"
      />
      <path
        fill="#FBBC05"
        d="M12 22c2.7 0 5-1 6.7-2.7L15.6 17c-.9.6-2.1 1-3.6 1-2.6 0-4.9-1.8-5.7-4.2L2.8 16.5C4.5 19.8 8 22 12 22Z"
      />
      <path
        fill="#4285F4"
        d="M21.6 12.2c0-.7-.1-1.2-.2-1.8H12v3.9h5.5c-.3 1.4-1.1 2.5-1.9 3.3l3.1 2.3c1.8-1.7 2.9-4.3 2.9-7.7Z"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-[var(--text-primary)]"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v3a5 5 0 0 0-5 5H4Z"
      />
    </svg>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const errorParam = searchParams.get("error");

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl);
    }
  }, [router, status, callbackUrl, session]);

  const handleGoogleSignIn = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const result = await signIn("google", { callbackUrl, redirect: false });

      if (result?.url) {
        window.location.href = result.url;
        return;
      }
    } catch (error) {
      void error;
    }

    setIsLoading(false);
  };

  return (
    <StandaloneShell maxWidth="sm">
      <div className="text-center">
        <span className="rw-eyebrow justify-center">Relay Web</span>
        <h1 className="mt-5 text-3xl font-semibold text-[var(--text-primary)]">
          Sign in to your workspace
        </h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          Access content, SEO, design, and billing controls from a single dashboard.
        </p>
      </div>

      {errorParam ? (
        <div className="mt-6 rounded-xl border border-[color:rgba(239,68,68,0.28)] bg-[var(--error-bg)] px-4 py-3 text-left text-sm text-[var(--error)]">
          We couldn&apos;t complete sign-in. Please try again.
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="rw-btn rw-btn-secondary mt-8 w-full justify-center py-3 text-sm"
      >
        {isLoading ? <Spinner /> : <GoogleLogo />}
        {isLoading ? "Redirecting..." : "Continue with Google"}
      </button>

      <div className="mt-8 flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
        <RiShieldCheckLine className="h-4 w-4" />
        <span>Google OAuth only. Your existing workspace email will be matched automatically.</span>
      </div>
    </StandaloneShell>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <StandaloneShell maxWidth="sm">
          <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
            <Spinner />
            <p className="text-sm text-[var(--text-secondary)]">Loading sign-in...</p>
          </div>
        </StandaloneShell>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
