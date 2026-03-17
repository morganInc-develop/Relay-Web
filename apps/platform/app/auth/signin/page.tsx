"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

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
      className="h-5 w-5 animate-spin text-slate-700"
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
  const [currentUrl, setCurrentUrl] = useState("");

  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const errorParam = searchParams.get("error");

  useEffect(() => {
    setCurrentUrl(window.location.href);

    console.log("[signin] page mounted");
    console.log("[signin] callbackUrl:", callbackUrl);
    console.log("[signin] error param:", errorParam ?? "none");
    console.log("[signin] window.location.href:", window.location.href);
    console.log("[signin] window.location.origin:", window.location.origin);
  }, [callbackUrl, errorParam]);

  useEffect(() => {
    console.log("[signin] session status changed:", status);
    console.log("[signin] session data:", session);
    if (status === "authenticated") {
      console.log("[signin] already authenticated, redirecting to", callbackUrl);
      router.replace(callbackUrl);
    }
  }, [router, status, callbackUrl, session]);

  const handleGoogleSignIn = async () => {
    if (isLoading) return;

    console.log("[signin] Google sign-in initiated");
    console.log("[signin] callbackUrl:", callbackUrl);
    console.log("[signin] window.location.origin:", window.location.origin);
    setIsLoading(true);
    try {
      const result = await signIn("google", { callbackUrl, redirect: false });
      console.log("[signin] signIn() result:", result);
      if (result?.error) {
        console.error("[signin] signIn() returned error:", result.error);
      }
      if (result?.url) {
        console.log("[signin] redirecting to:", result.url);
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("[signin] Google sign-in threw:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        {/* DEBUG PANEL */}
        <details className="rounded-xl border-2 border-yellow-400 bg-yellow-50 p-4 text-xs" open>
          <summary className="cursor-pointer font-bold text-yellow-800">
            🐛 DEBUG — Sign-in Page (click to collapse)
          </summary>
          <table className="mt-3 w-full border-collapse font-mono">
            <tbody>
              <tr className="border-t border-yellow-200">
                <td className="py-1 pr-4 text-slate-600">Session status</td>
                <td className={`py-1 font-bold ${status === "authenticated" ? "text-green-700" : status === "loading" ? "text-yellow-600" : "text-red-600"}`}>
                  {status}
                </td>
              </tr>
              <tr className="border-t border-yellow-200">
                <td className="py-1 pr-4 text-slate-600">Session user</td>
                <td className="py-1 text-slate-800">{session?.user?.email ?? "none"}</td>
              </tr>
              <tr className="border-t border-yellow-200">
                <td className="py-1 pr-4 text-slate-600">callbackUrl param</td>
                <td className="py-1 text-slate-800">{callbackUrl}</td>
              </tr>
              <tr className="border-t border-yellow-200">
                <td className="py-1 pr-4 text-slate-600">error param</td>
                <td className={`py-1 font-bold ${errorParam ? "text-red-600" : "text-slate-400"}`}>
                  {errorParam ?? "none"}
                </td>
              </tr>
              <tr className="border-t border-yellow-200">
                <td className="py-1 pr-4 text-slate-600">current URL</td>
                <td className="break-all py-1 text-slate-800">{currentUrl}</td>
              </tr>
            </tbody>
          </table>
        </details>

        {/* Original sign-in card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-center">
            <p className="text-2xl font-bold tracking-tight text-slate-900">
              RelayWeb
            </p>
            <h1 className="mt-6 text-2xl font-semibold text-slate-900">
              Sign in to RelayWeb
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Manage your website from one place
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className={`mt-8 flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed ${
              isLoading ? "opacity-60" : "opacity-100"
            }`}
          >
            {isLoading ? <Spinner /> : <GoogleLogo />}
            {isLoading ? "Redirecting..." : "Continue with Google"}
          </button>

          <p className="mt-8 text-center text-xs text-slate-500">
            By signing in you agree to our terms of service
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-100">
          <Spinner />
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
