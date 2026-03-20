"use client"

import { useEffect, useState } from "react"
import { RiCheckboxCircleLine } from "react-icons/ri"

type LinkStatus =
  | { status: "loading" }
  | { status: "no-site" }
  | { status: "unverified" }
  | { status: "verified-unlinked"; domain: string }
  | {
      status: "linked"
      domain: string
      repoUrl: string
      payloadUrl: string
      vercelProjectId: string | null
      linkedAt: string
    }
  | { status: "error"; message: string }

export default function SiteLinking() {
  const [linkStatus, setLinkStatus] = useState<LinkStatus>({ status: "loading" })
  const [repoUrl, setRepoUrl] = useState("")
  const [payloadUrl, setPayloadUrl] = useState("")
  const [clientDbUrl, setClientDbUrl] = useState("")
  const [vercelProjectId, setVercelProjectId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/site/link-status")
      .then((r) => r.json())
      .then((data: LinkStatus) => setLinkStatus(data))
      .catch(() =>
        setLinkStatus({ status: "error", message: "Failed to load link status. Please refresh." })
      )
  }, [])

  const handleSubmit = async () => {
    if (!repoUrl.trim() || !payloadUrl.trim() || !clientDbUrl.trim()) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch("/api/site/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl: repoUrl.trim(),
          payloadUrl: payloadUrl.trim(),
          clientDbUrl: clientDbUrl.trim(),
          vercelProjectId: vercelProjectId.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to link site")
      // Re-fetch status to reflect linked state
      const statusRes = await fetch("/api/site/link-status")
      const statusData: LinkStatus = await statusRes.json()
      setLinkStatus(statusData)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (linkStatus.status === "loading") {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-500)]" />
      </div>
    )
  }

  // ── No site / unverified ───────────────────────────────────────────────────
  if (
    linkStatus.status === "no-site" ||
    linkStatus.status === "unverified" ||
    linkStatus.status === "error"
  ) {
    const message =
      linkStatus.status === "error"
        ? linkStatus.message
        : linkStatus.status === "no-site"
          ? "You must verify your domain before linking your site."
          : "Domain verification is required before linking."
    return (
      <div className="rounded-lg border border-[color:rgba(245,158,11,0.25)] bg-[var(--warning-bg)] px-4 py-3">
        <p className="text-sm text-[var(--warning)]">{message}</p>
      </div>
    )
  }

  // ── Linked ─────────────────────────────────────────────────────────────────
  if (linkStatus.status === "linked") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-lg border border-[color:rgba(34,197,94,0.25)] bg-[var(--success-bg)] px-4 py-3">
          <RiCheckboxCircleLine className="h-5 w-5 text-[var(--success)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--success)]">Site linked</p>
            <p className="text-xs text-[var(--success)]">
              Linked on{" "}
              {new Date(linkStatus.linkedAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 text-sm">
          <p>
            <span className="text-[var(--text-secondary)]">Domain:</span>{" "}
            <span className="font-medium text-[var(--text-primary)]">{linkStatus.domain}</span>
          </p>
          <p>
            <span className="text-[var(--text-secondary)]">Repo:</span>{" "}
            <span className="font-medium break-all text-[var(--text-primary)]">{linkStatus.repoUrl}</span>
          </p>
          <p>
            <span className="text-[var(--text-secondary)]">Payload URL:</span>{" "}
            <span className="font-medium break-all text-[var(--text-primary)]">{linkStatus.payloadUrl}</span>
          </p>
          {linkStatus.vercelProjectId && (
            <p>
              <span className="text-[var(--text-secondary)]">Vercel Project:</span>{" "}
              <span className="font-medium text-[var(--text-primary)]">{linkStatus.vercelProjectId}</span>
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── Verified, not yet linked ───────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        Domain <span className="font-medium text-[var(--text-primary)]">{linkStatus.domain}</span> is verified.
        Now link your site infrastructure.
      </p>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
            GitHub Repo URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/your-org/your-repo"
            className="rw-input"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
            Payload CMS URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={payloadUrl}
            onChange={(e) => setPayloadUrl(e.target.value)}
            placeholder="https://cms.yourdomain.com"
            className="rw-input"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
            Client Database URL <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={clientDbUrl}
            onChange={(e) => setClientDbUrl(e.target.value)}
            placeholder="postgresql://..."
            className="rw-input font-mono"
          />
          <p className="mt-1 text-xs text-[var(--text-muted)]">Stored encrypted. Never shown again.</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
            Vercel Project ID{" "}
            <span className="font-normal text-[var(--text-muted)]">(optional)</span>
          </label>
          <input
            type="text"
            value={vercelProjectId}
            onChange={(e) => setVercelProjectId(e.target.value)}
            placeholder="prj_..."
            className="rw-input font-mono"
          />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !repoUrl.trim() || !payloadUrl.trim() || !clientDbUrl.trim()}
        className="rw-btn rw-btn-primary"
      >
        {isSubmitting ? "Linking..." : "Link Site"}
      </button>

      {submitError && (
        <div className="rounded-lg border border-[color:rgba(239,68,68,0.25)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error)]">
          {submitError}
        </div>
      )}
    </div>
  )
}
