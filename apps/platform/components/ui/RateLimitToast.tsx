"use client"

import { useEffect, useState } from "react"
import { X, Clock, Zap } from "lucide-react"
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
        bg-gray-900 text-white
        rounded-xl shadow-2xl border border-gray-700
        px-4 py-3.5
        transition-all duration-300 ease-out
        ${isLeaving ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"}
      `}
      role="alert"
      aria-live="assertive"
    >
      {/* Icon */}
      <div className="shrink-0 mt-0.5">
        <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
          <Zap className="w-4 h-4 text-amber-400" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white leading-tight">
          {getLimiterMessage(limiterHint)}
        </p>
        {!isExpired ? (
          <div className="flex items-center gap-1.5 mt-1">
            <Clock className="w-3 h-3 text-gray-400 shrink-0" />
            <p className="text-xs text-gray-400">
              Resets in{" "}
              <span className="text-amber-400 font-medium tabular-nums">
                {timeRemaining}
              </span>
            </p>
          </div>
        ) : (
          <p className="text-xs text-green-400 mt-1 font-medium">
            ✓ You can try again now
          </p>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="shrink-0 text-gray-500 hover:text-gray-300 transition-colors mt-0.5"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
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
