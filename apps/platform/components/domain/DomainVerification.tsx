"use client"

import { useEffect, useRef, useState } from "react"

type VerificationStatus =
  | { status: "none" }
  | { status: "pending"; domain: string; token: string; expiresAt: string }
  | { status: "verified"; domain: string; verifiedAt: string }
  | { status: "expired"; domain: string }
  | { status: "loading" }
  | { status: "error"; message: string; previousStatus: "none" | "pending" | "expired" }

export default function DomainVerification() {
  const [state, setState] = useState<VerificationStatus>({ status: "loading" })
  const [domain, setDomain] = useState("")
  const [isActing, setIsActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Saves the last known pending data so verify UI stays visible if verification fails
  const savedPending = useRef<Extract<VerificationStatus, { status: "pending" }> | null>(null)

  useEffect(() => {
    fetch("/api/verify/status")
      .then((r) => r.json())
      .then((data: VerificationStatus) => {
        setState(data)
        if ("domain" in data && data.domain) setDomain(data.domain)
        if (data.status === "pending") savedPending.current = data
      })
      .catch(() =>
        setState({
          status: "error",
          message: "Failed to load verification status. Please refresh.",
          previousStatus: "none",
        })
      )
  }, [])

  const generateToken = async () => {
    if (!domain.trim()) return
    setIsActing(true)
    setActionError(null)
    try {
      const res = await fetch("/api/verify/generate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to generate token")
      const next: Extract<VerificationStatus, { status: "pending" }> = {
        status: "pending",
        domain: data.domain,
        token: data.token,
        expiresAt: data.expiresAt,
      }
      savedPending.current = next
      setState(next)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsActing(false)
    }
  }

  const verify = async () => {
    // Snapshot current pending state before we show loading
    if (state.status === "pending") savedPending.current = state
    setIsActing(true)
    setActionError(null)
    try {
      const res = await fetch("/api/verify/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Verification failed")
      if (data.verified) {
        setState({
          status: "verified",
          domain: data.domain,
          verifiedAt: data.verifiedAt ?? new Date().toISOString(),
        })
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong")
      // Restore pending state so the UI stays visible for retry
      if (savedPending.current) setState(savedPending.current)
    } finally {
      setIsActing(false)
    }
  }

  const handleCopy = async (metaTag: string) => {
    await navigator.clipboard.writeText(metaTag)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const resetToNone = () => {
    setState({ status: "none" })
    setDomain("")
    setActionError(null)
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }

  // ── Verified ───────────────────────────────────────────────────────────────
  if (state.status === "verified") {
    return (
      <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
        <span className="text-green-600 text-xl leading-none">✓</span>
        <div>
          <p className="text-sm font-semibold text-green-800">{state.domain}</p>
          <p className="text-xs text-green-600">
            Verified on{" "}
            {new Date(state.verifiedAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </div>
    )
  }

  // ── None ──────────────────────────────────────────────────────────────────
  if (state.status === "none" || (state.status === "error" && state.previousStatus === "none")) {
    const errorMsg = state.status === "error" ? state.message : actionError
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Your domain <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generateToken()}
            placeholder="yourdomain.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <p className="text-xs text-gray-400 mt-1">Enter without https:// or www</p>
        </div>
        <button
          onClick={generateToken}
          disabled={isActing || !domain.trim()}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {isActing ? "Generating..." : "Generate Token"}
        </button>
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
      </div>
    )
  }

  // ── Pending ───────────────────────────────────────────────────────────────
  if (state.status === "pending") {
    const metaTag = `<meta name="relayweb-verification" content="${state.token}" />`
    return (
      <div className="space-y-4">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-600">
              Domain:{" "}
              <span className="font-medium text-gray-900">{state.domain}</span>
            </p>
            <p className="text-xs text-gray-400">
              Expires {new Date(state.expiresAt).toLocaleString()}
            </p>
          </div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            Add this to your site&apos;s{" "}
            <code className="bg-gray-200 px-1 rounded text-xs">&lt;head&gt;</code>:
          </p>
          <div className="flex items-start gap-2">
            <code className="flex-1 text-xs bg-white border border-gray-200 rounded px-3 py-2 break-all font-mono text-gray-700 leading-relaxed">
              {metaTag}
            </code>
            <button
              onClick={() => handleCopy(metaTag)}
              className="flex-shrink-0 px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
          <li>Copy the meta tag above</li>
          <li>
            Paste it inside the{" "}
            <code className="bg-gray-100 px-1 rounded text-xs">&lt;head&gt;</code> of your site&apos;s{" "}
            <code className="bg-gray-100 px-1 rounded text-xs">app/layout.tsx</code>
          </li>
          <li>Redeploy your site on Vercel</li>
          <li>Click Verify Now below</li>
        </ol>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={verify}
            disabled={isActing}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {isActing ? "Checking..." : "Verify Now"}
          </button>
          <button
            onClick={resetToNone}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Use a different domain
          </button>
        </div>

        {actionError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        )}
      </div>
    )
  }

  // ── Expired ───────────────────────────────────────────────────────────────
  if (state.status === "expired" || (state.status === "error" && state.previousStatus === "expired")) {
    const expiredDomain = state.status === "expired" ? state.domain : domain
    const errorMsg = state.status === "error" ? state.message : actionError
    return (
      <div className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
          <p className="text-sm font-semibold text-yellow-800">Verification token expired</p>
          <p className="text-sm text-yellow-700 mt-1">{expiredDomain}</p>
          <p className="text-xs text-yellow-600 mt-1">
            Generate a new token, add it to your site, and verify again.
          </p>
        </div>
        <button
          onClick={() => {
            if (state.status === "expired") setDomain(state.domain)
            generateToken()
          }}
          disabled={isActing}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {isActing ? "Generating..." : "Regenerate Token"}
        </button>
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
      </div>
    )
  }

  return null
}
