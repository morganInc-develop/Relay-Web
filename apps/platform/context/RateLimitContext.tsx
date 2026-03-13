"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"

interface RateLimitError {
  id: string
  message: string
  resetAt: Date
  limiterHint?: string
}

interface RateLimitContextValue {
  errors: RateLimitError[]
  showRateLimitError: (resetAt: string, limiterHint?: string) => void
  dismissError: (id: string) => void
}

const RateLimitContext = createContext<RateLimitContextValue | null>(null)

export function RateLimitProvider({ children }: { children: ReactNode }) {
  const [errors, setErrors] = useState<RateLimitError[]>([])

  const showRateLimitError = useCallback((resetAt: string, limiterHint?: string) => {
    const id = crypto.randomUUID()
    const resetDate = new Date(resetAt)

    setErrors((prev) => {
      // Deduplicate — don't stack the same limiter
      const alreadyShowing = prev.some(
        (e) => Math.abs(e.resetAt.getTime() - resetDate.getTime()) < 5000
      )
      if (alreadyShowing) return prev
      return [...prev, { id, message: "Rate limit exceeded", resetAt: resetDate, limiterHint }]
    })

    // Auto-dismiss 3 seconds after reset time
    const msUntilReset = resetDate.getTime() - Date.now()
    const dismissAfter = Math.max(msUntilReset + 3000, 5000)
    setTimeout(() => {
      setErrors((prev) => prev.filter((e) => e.id !== id))
    }, dismissAfter)
  }, [])

  const dismissError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id))
  }, [])

  return (
    <RateLimitContext.Provider value={{ errors, showRateLimitError, dismissError }}>
      {children}
    </RateLimitContext.Provider>
  )
}

export function useRateLimit() {
  const ctx = useContext(RateLimitContext)
  if (!ctx) throw new Error("useRateLimit must be used inside RateLimitProvider")
  return ctx
}
