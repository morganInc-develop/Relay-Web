"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const errorMessages: Record<string, string> = {
  OAuthAccountNotLinked:
    "This email is already associated with another sign in method",
  AccessDenied: "You do not have permission to sign in",
};

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") ?? "";
  const message =
    errorMessages[error] ??
    "An error occurred during sign in. Please try again.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <p className="text-2xl font-bold tracking-tight text-slate-900">
            RelayWeb
          </p>
          <h1 className="mt-6 text-2xl font-semibold text-slate-900">
            Sign-in Error
          </h1>
          <p className="mt-3 text-sm text-slate-600">{message}</p>
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
