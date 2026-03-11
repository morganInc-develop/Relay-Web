export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <main className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          RelayWeb
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900 md:text-4xl">
          White-label client dashboard for modern websites
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-slate-600">
          Manage content, SEO, analytics, design, and AI-powered updates from
          one place.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="/auth/signin"
            className="inline-flex rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Sign in
          </a>
          <a
            href="/onboarding"
            className="inline-flex rounded-lg bg-slate-100 px-5 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-200"
          >
            View plans
          </a>
        </div>
      </main>
    </div>
  );
}
