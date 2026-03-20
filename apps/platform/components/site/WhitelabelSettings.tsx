"use client"

import { useState } from "react"

interface WhitelabelSettingsProps {
  initialUrl: string | null
}

interface WhitelabelResponse {
  success?: boolean
  whitelabelUrl?: string | null
  error?: string
}

export default function WhitelabelSettings({ initialUrl }: WhitelabelSettingsProps) {
  const [url, setUrl] = useState(initialUrl ?? "")
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null)

  const saveUrl = async () => {
    setSaving(true)
    setToast(null)

    try {
      const response = await fetch("/api/site/whitelabel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
      const data = (await response.json()) as WhitelabelResponse
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save")
      }

      setUrl(data.whitelabelUrl ?? "")
      setToast({ kind: "success", message: "White-label URL updated." })
    } catch (error) {
      setToast({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to save",
      })
    } finally {
      setSaving(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  return (
    <div className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-700">Dashboard URL</span>
        <input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://dashboard.yoursite.com"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
        />
      </label>

      <p className="mt-3 text-xs text-slate-500">
        Point your DNS CNAME to this dashboard domain. Changes take effect after DNS
        propagation.
      </p>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => void saveUrl()}
          disabled={saving}
          className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {toast ? (
        <div
          className={`fixed bottom-6 right-6 rounded-md px-3 py-2 text-xs font-medium shadow-sm ${
            toast.kind === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  )
}
