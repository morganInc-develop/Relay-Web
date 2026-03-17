// Debug: server-side env checks
console.log("[home] rendering home page");
console.log("[home] NODE_ENV:", process.env.NODE_ENV);
console.log("[home] AUTH_SECRET present:", !!process.env.AUTH_SECRET);
console.log("[home] NEXTAUTH_SECRET present:", !!process.env.NEXTAUTH_SECRET);
console.log("[home] AUTH_URL:", process.env.AUTH_URL ?? "(not set)");
console.log("[home] NEXTAUTH_URL:", process.env.NEXTAUTH_URL ?? "(not set)");
console.log("[home] GOOGLE_CLIENT_ID present:", !!process.env.GOOGLE_CLIENT_ID);
console.log("[home] GOOGLE_CLIENT_SECRET present:", !!process.env.GOOGLE_CLIENT_SECRET);
console.log("[home] DATABASE_URL present:", !!process.env.DATABASE_URL);
console.log("[home] DIRECT_URL present:", !!process.env.DIRECT_URL);

export default function Home() {
  const debugInfo = {
    NODE_ENV: process.env.NODE_ENV ?? "(not set)",
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL ?? "(not set)",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "(not set)",
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    DATABASE_URL: !!process.env.DATABASE_URL,
    DIRECT_URL: !!process.env.DIRECT_URL,
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <main className="w-full max-w-3xl space-y-4">
        {/* DEBUG PANEL */}
        <details className="rounded-xl border-2 border-yellow-400 bg-yellow-50 p-4 text-xs">
          <summary className="cursor-pointer font-bold text-yellow-800">
            🐛 DEBUG — Server Env Check (click to expand)
          </summary>
          <table className="mt-3 w-full border-collapse">
            <thead>
              <tr className="text-left text-yellow-700">
                <th className="pb-1 pr-4">Variable</th>
                <th className="pb-1">Value / Present</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {Object.entries(debugInfo).map(([key, val]) => (
                <tr key={key} className="border-t border-yellow-200">
                  <td className="py-1 pr-4 text-slate-700">{key}</td>
                  <td
                    className={`py-1 ${
                      val === false || val === "(not set)"
                        ? "font-bold text-red-600"
                        : "text-green-700"
                    }`}
                  >
                    {typeof val === "boolean" ? (val ? "✅ present" : "❌ MISSING") : val}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>

        {/* Original page content */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
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
        </div>
      </main>
    </div>
  );
}
