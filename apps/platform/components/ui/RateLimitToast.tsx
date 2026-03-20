"use client"

import { useEffect, useState } from "react"
import { RiAlarmWarningLine, RiCloseLine, RiTimer2Line } from "react-icons/ri"
import { useRateLimit } from "@/context/RateLimitContext"

function formatTimeRemaining(resetAt: Date): string {
  const diff = Math.max(0, resetAt.getTime() - Date.now())
  const totalSeconds = Math.ceil(diff / 1000)

  if (totalSeconds <= 0) return "Resetting now..."
  if (totalSeconds < 60) return `${totalSeconds}s`

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (seconds === 0) return `${minutes}m`
  return `${minutes}m ${seconds}s`
}

function getLimiterMessage(hint?: string): string {
  switch (hint) {
    case "auth":
      return "Too many sign-in attempts"
    case "contentUpdate":
      return "Too many content saves — slow down a bit"
    case "aiTier1":
    case "aiTier2":
      return "Daily AI request limit reached"
    case "seoAudit":
      return "Too many SEO audits this hour"
    case "imageUpload":
      return "Too many image uploads this hour"
    case "stripeWebhook":
      return "Too many requests"
    default:
      return "Too many requests — please slow down"
  }
}

function SingleToast({
  id,
  resetAt,
  limiterHint,
}: {
  id: string
  resetAt: Date
  limiterHint?: string
}) {
  const { dismissError } = useRateLimit()
  const [timeRemaining, setTimeRemaining] = useState(() => formatTimeRemaining(resetAt))
  const [isLeaving, setIsLeaving] = useState(false)
  const isExpired = timeRemaining === "Resetting now..."

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(formatTimeRemaining(resetAt))
    }, 1000)
    return () => clearInterval(interval)
  }, [resetAt])

  function handleDismiss() {
    setIsLeaving(true)
    setTimeout(() => dismissError(id), 300)
  }

  return (
    <div
      className={`
        flex items-start gap-3 w-full max-w-sm
        rounded-xl border border-[var(--border-default)] bg-[var(--bg-overlay)] text-[var(--text-primary)]
        px-4 py-3.5
        shadow-[var(--shadow-lg)]
        transition-all duration-300 ease-out
        ${isLeaving ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"}
      `}
      role="alert"
      aria-live="assertive"
    >
      {/* Icon */}
      <div className="shrink-0 mt-0.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--warning-bg)]">
          <RiAlarmWarningLine className="h-4 w-4 text-[var(--warning)]" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white leading-tight">
          {getLimiterMessage(limiterHint)}
        </p>
        {!isExpired ? (
          <div className="flex items-center gap-1.5 mt-1">
            <RiTimer2Line className="h-3 w-3 shrink-0 text-[var(--text-muted)]" />
            <p className="text-xs text-[var(--text-secondary)]">
              Resets in{" "}
              <span className="font-medium tabular-nums text-[var(--warning)]">
                {timeRemaining}
              </span>
            </p>
          </div>
        ) : (
          <p className="mt-1 text-xs font-medium text-[var(--success)]">
            You can try again now
          </p>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="mt-0.5 shrink-0 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        aria-label="Dismiss notification"
      >
        <RiCloseLine className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function RateLimitToast() {
  const { errors } = useRateLimit()

  if (errors.length === 0) return null

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none"
      aria-label="Rate limit notifications"
    >
      {errors.map((error) => (
        <div key={error.id} className="pointer-events-auto">
          <SingleToast
            id={error.id}
            resetAt={error.resetAt}
            limiterHint={error.limiterHint}
          />
        </div>
      ))}
    </div>
  )
}
