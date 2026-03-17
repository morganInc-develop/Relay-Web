"use client"

import { useEffect, useState } from "react"

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
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
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
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
        <p className="text-sm text-yellow-800">{message}</p>
      </div>
    )
  }

  // ── Linked ─────────────────────────────────────────────────────────────────
  if (linkStatus.status === "linked") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <span className="text-green-600 text-xl leading-none">✓</span>
          <div>
            <p className="text-sm font-semibold text-green-800">Site linked</p>
            <p className="text-xs text-green-600">
              Linked on{" "}
              {new Date(linkStatus.linkedAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-sm">
          <p>
            <span className="text-gray-500">Domain:</span>{" "}
            <span className="font-medium">{linkStatus.domain}</span>
          </p>
          <p>
            <span className="text-gray-500">Repo:</span>{" "}
            <span className="font-medium break-all">{linkStatus.repoUrl}</span>
          </p>
          <p>
            <span className="text-gray-500">Payload URL:</span>{" "}
            <span className="font-medium break-all">{linkStatus.payloadUrl}</span>
          </p>
          {linkStatus.vercelProjectId && (
            <p>
              <span className="text-gray-500">Vercel Project:</span>{" "}
              <span className="font-medium">{linkStatus.vercelProjectId}</span>
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── Verified, not yet linked ───────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Domain <span className="font-medium text-gray-900">{linkStatus.domain}</span> is verified.
        Now link your site infrastructure.
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            GitHub Repo URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/your-org/your-repo"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payload CMS URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={payloadUrl}
            onChange={(e) => setPayloadUrl(e.target.value)}
            placeholder="https://cms.yourdomain.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Client Database URL <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={clientDbUrl}
            onChange={(e) => setClientDbUrl(e.target.value)}
            placeholder="postgresql://..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <p className="text-xs text-gray-400 mt-1">Stored encrypted. Never shown again.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Vercel Project ID{" "}
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={vercelProjectId}
            onChange={(e) => setVercelProjectId(e.target.value)}
            placeholder="prj_..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !repoUrl.trim() || !payloadUrl.trim() || !clientDbUrl.trim()}
        className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
      >
        {isSubmitting ? "Linking..." : "Link Site"}
      </button>

      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      )}
    </div>
  )
}
