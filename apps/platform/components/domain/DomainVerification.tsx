"use client"

import { useEffect, useRef, useState } from "react"
import { RiCheckboxCircleLine } from "react-icons/ri"

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
      const res = await fetch("/api/verify/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to generate token")
      if (data.verified) {
        setState({
          status: "verified",
          domain: data.domain,
          verifiedAt: data.verifiedAt ?? new Date().toISOString(),
        })
      } else {
        const next: Extract<VerificationStatus, { status: "pending" }> = {
          status: "pending",
          domain: data.domain,
          token: data.token,
          expiresAt: data.expiresAt,
        }
        savedPending.current = next
        setState(next)
        if (data.message) setActionError(String(data.message))
      }
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
        body: JSON.stringify({ domain: state.status === "pending" ? state.domain : domain }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Verification failed")
      if (data.verified) {
        setState({
          status: "verified",
          domain: data.domain,
          verifiedAt: data.verifiedAt ?? new Date().toISOString(),
        })
      } else {
        const next: Extract<VerificationStatus, { status: "pending" }> = {
          status: "pending",
          domain: data.domain,
          token: data.token,
          expiresAt: data.expiresAt,
        }
        savedPending.current = next
        setState(next)
        setActionError(data.message ?? "Verification tag not found yet.")
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
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-500)]" />
      </div>
    )
  }

  // ── Verified ───────────────────────────────────────────────────────────────
  if (state.status === "verified") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-[color:rgba(34,197,94,0.25)] bg-[var(--success-bg)] px-4 py-3">
        <RiCheckboxCircleLine className="h-5 w-5 text-[var(--success)]" />
        <div>
          <p className="text-sm font-semibold text-[var(--success)]">{state.domain}</p>
          <p className="text-xs text-[var(--success)]">
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
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
            Your domain <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generateToken()}
            placeholder="yourdomain.com"
            className="rw-input"
          />
          <p className="mt-1 text-xs text-[var(--text-muted)]">Enter without https:// or www</p>
        </div>
        <button
          onClick={generateToken}
          disabled={isActing || !domain.trim()}
          className="rw-btn rw-btn-primary"
        >
          {isActing ? "Generating..." : "Generate Token"}
        </button>
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
      </div>
    )
  }

  // ── Pending ───────────────────────────────────────────────────────────────
  if (state.status === "pending") {
    const metaTag = `<meta name="relay-verify" content="${state.token}" />`
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-[var(--text-secondary)]">
              Domain:{" "}
              <span className="font-medium text-[var(--text-primary)]">{state.domain}</span>
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Expires {new Date(state.expiresAt).toLocaleString()}
            </p>
          </div>
          <p className="mb-2 text-sm font-medium text-[var(--text-secondary)]">
            Add this to your site&apos;s{" "}
            <code className="rounded bg-[var(--bg-overlay)] px-1 text-xs">&lt;head&gt;</code>:
          </p>
          <div className="flex items-start gap-2">
            <code className="flex-1 break-all rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 font-mono text-xs leading-relaxed text-[var(--text-secondary)]">
              {metaTag}
            </code>
            <button
              onClick={() => handleCopy(metaTag)}
              className="rw-btn rw-btn-secondary shrink-0 whitespace-nowrap px-3 py-2 text-xs"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <ol className="list-inside list-decimal space-y-1 text-sm text-[var(--text-secondary)]">
          <li>Copy the meta tag above</li>
          <li>
            Paste it inside the{" "}
            <code className="rounded bg-[var(--bg-overlay)] px-1 text-xs">&lt;head&gt;</code> of your site&apos;s{" "}
            <code className="rounded bg-[var(--bg-overlay)] px-1 text-xs">app/layout.tsx</code>
          </li>
          <li>Redeploy your site on Vercel</li>
          <li>Click Verify Now below</li>
        </ol>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={verify}
            disabled={isActing}
            className="rw-btn rw-btn-primary"
          >
            {isActing ? "Checking..." : "Verify Now"}
          </button>
          <button
            onClick={resetToNone}
            className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            Use a different domain
          </button>
        </div>

        {actionError && (
          <div className="rounded-lg border border-[color:rgba(239,68,68,0.25)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error)]">
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
