"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

import StandaloneShell from "@/components/ui/StandaloneShell"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <StandaloneShell maxWidth="sm">
          <div className="text-center">
            <span className="rw-eyebrow justify-center">Relay Web</span>
            <h1 className="mt-5 text-3xl font-semibold text-[var(--text-primary)]">Something went wrong</h1>
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              An unexpected error occurred and has been reported automatically. If it keeps happening,
              contact hello@morgandev.studio.
            </p>
            <button
              onClick={reset}
              className="rw-btn rw-btn-primary mt-8"
            >
              Try again
            </button>
          </div>
        </StandaloneShell>
      </body>
    </html>
  )
}
