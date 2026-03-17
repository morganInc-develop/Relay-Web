"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const errorMessages: Record<string, string> = {
  OAuthAccountNotLinked:
    "This email is already associated with another sign in method",
  AccessDenied: "You do not have permission to sign in",
  Configuration: "There is a problem with the server configuration.",
  Verification: "The verification token has expired or has already been used.",
  OAuthSignin: "Error in constructing an authorization URL.",
  OAuthCallback: "Error in handling the response from the OAuth provider.",
  OAuthCreateAccount: "Could not create OAuth provider user in the database.",
  EmailCreateAccount: "Could not create email provider user in the database.",
  Callback: "Error in the OAuth callback handler route.",
  Default: "An unknown error occurred.",
};

function ErrorDetails() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") ?? "";
  const message = errorMessages[error] ?? "An error occurred during sign in. Please try again.";
  const [currentUrl, setCurrentUrl] = useState("");

  useEffect(() => {
    setCurrentUrl(window.location.href);
    console.error("[auth:error] page rendered");
    console.error("[auth:error] error code:", error || "none");
    console.error("[auth:error] full URL:", window.location.href);
    console.error("[auth:error] search params:", window.location.search);
  }, [error]);

  return (
    <>
      {/* DEBUG PANEL — open by default so it's immediately visible */}
      <details className="mb-4 rounded-xl border-2 border-red-400 bg-red-50 p-4 text-xs" open>
        <summary className="cursor-pointer font-bold text-red-800">
          🐛 DEBUG — Auth Error Details
        </summary>
        <table className="mt-3 w-full border-collapse font-mono">
          <tbody>
            <tr className="border-t border-red-200">
              <td className="py-1 pr-4 text-slate-600">Error code</td>
              <td className="py-1 font-bold text-red-700">{error || "(none)"}</td>
            </tr>
            <tr className="border-t border-red-200">
              <td className="py-1 pr-4 text-slate-600">Error message</td>
              <td className="py-1 text-slate-800">{message}</td>
            </tr>
            <tr className="border-t border-red-200">
              <td className="py-1 pr-4 text-slate-600">Full URL</td>
              <td className="break-all py-1 text-slate-800">{currentUrl}</td>
            </tr>
          </tbody>
        </table>

        <p className="mt-3 text-red-700">
          <strong>What this means:</strong>
        </p>
        <ul className="mt-1 list-inside list-disc space-y-1 text-slate-700">
          {error === "Configuration" && (
            <>
              <li>AUTH_SECRET may be missing or invalid in Vercel env vars</li>
              <li>GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET may be missing</li>
              <li>Database connection (Prisma) may be failing</li>
              <li>AUTH_URL / NEXTAUTH_URL may be set to localhost</li>
            </>
          )}
          {error === "OAuthCallback" && (
            <>
              <li>The Google OAuth callback URL is not authorized in Google Cloud Console</li>
              <li>Expected redirect URI: {currentUrl.split("/api/auth")[0]}/api/auth/callback/google</li>
            </>
          )}
          {error === "OAuthCreateAccount" && (
            <li>Prisma failed to create the user in the database — check DATABASE_URL</li>
          )}
          {!error && <li>No error code in URL — check server logs for more info</li>}
        </ul>
      </details>

      <p className="mt-3 text-sm text-slate-600">{message}</p>
    </>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <p className="text-2xl font-bold tracking-tight text-slate-900">
            RelayWeb
          </p>
          <h1 className="mt-6 text-2xl font-semibold text-slate-900">
            Sign-in Error
          </h1>
          <Suspense fallback={<p className="mt-3 text-sm text-slate-600">Loading...</p>}>
            <ErrorDetails />
          </Suspense>
        </div>

        <Link
          href="/auth/signin"
          className="mt-8 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}
