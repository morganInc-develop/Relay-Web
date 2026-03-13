"use client"

import { useEffect } from "react"
import { useRateLimit } from "@/context/RateLimitContext"

export default function FetchInterceptor() {
  const { showRateLimitError } = useRateLimit()

  useEffect(() => {
    const originalFetch = window.fetch

    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args)

      // Clone so the original response body is still readable by the caller
      if (response.status === 429) {
        try {
          const clone = response.clone()
          const data = await clone.json()
          const resetAt = data?.resetAt ?? new Date(Date.now() + 60000).toISOString()

          // Try to infer which limiter fired from the URL
          const url =
            typeof args[0] === "string"
              ? args[0]
              : args[0] instanceof Request
              ? args[0].url
              : ""

          let limiterHint: string | undefined
          if (url.includes("/api/auth")) limiterHint = "auth"
          else if (url.includes("/api/content")) limiterHint = "contentUpdate"
          else if (url.includes("/api/ai")) limiterHint = "aiTier1"
          else if (url.includes("/api/seo")) limiterHint = "seoAudit"
          else if (url.includes("/api/media")) limiterHint = "imageUpload"
          else if (url.includes("/api/stripe")) limiterHint = "stripeWebhook"

          showRateLimitError(resetAt, limiterHint)
        } catch {
          // If we can't parse the body just show a generic toast
          showRateLimitError(new Date(Date.now() + 60000).toISOString())
        }
      }

      return response
    }

    // Restore original fetch on unmount
    return () => {
      window.fetch = originalFetch
    }
  }, [showRateLimitError])

  return null
}
