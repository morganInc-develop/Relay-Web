"use client"

import { useState } from "react"
import { toast } from "sonner"

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

  const saveUrl = async () => {
    setSaving(true)

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
      toast.success("White-label URL updated.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rw-card p-5">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Dashboard URL</span>
        <input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://dashboard.yoursite.com"
          className="rw-input"
        />
      </label>

      <p className="mt-3 text-xs text-[var(--text-secondary)]">
        Point your DNS CNAME to this dashboard domain. Changes take effect after DNS
        propagation.
      </p>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => void saveUrl()}
          disabled={saving}
          className="rw-btn rw-btn-primary"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  )
}
