"use client"

import { useState } from "react"

interface SitemapManagerProps {
  initialEntries: Array<{
    pageSlug: string
    include: boolean
    priority: number
    changefreq: string
  }>
  availablePages: Array<{ slug: string; title: string }>
}

interface SitemapEntryState {
  pageSlug: string
  title: string
  include: boolean
  priority: number
  changefreq: string
}

interface SitemapResponse {
  success?: boolean
  count?: number
  error?: string
}

const PRIORITY_OPTIONS = ["0.1", "0.3", "0.5", "0.7", "0.9", "1.0"]
const CHANGEFREQ_OPTIONS = [
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never",
]

function buildEntries(
  availablePages: SitemapManagerProps["availablePages"],
  initialEntries: SitemapManagerProps["initialEntries"]
): SitemapEntryState[] {
  const entryMap = new Map(initialEntries.map((entry) => [entry.pageSlug, entry]))

  return availablePages.map((page) => {
    const savedEntry = entryMap.get(page.slug)

    return {
      pageSlug: page.slug,
      title: page.title,
      include: savedEntry?.include ?? true,
      priority: savedEntry?.priority ?? 0.5,
      changefreq: savedEntry?.changefreq ?? "weekly",
    }
  })
}

export default function SitemapManager({
  initialEntries,
  availablePages,
}: SitemapManagerProps) {
  const [entries, setEntries] = useState<SitemapEntryState[]>(
    buildEntries(availablePages, initialEntries)
  )
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null)

  const updateEntry = (pageSlug: string, nextEntry: Partial<SitemapEntryState>) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.pageSlug === pageSlug ? { ...entry, ...nextEntry } : entry
      )
    )
  }

  const saveSettings = async () => {
    setSaving(true)
    setToast(null)

    try {
      const response = await fetch("/api/site/sitemap", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: entries.map(({ pageSlug, include, priority, changefreq }) => ({
            pageSlug,
            include,
            priority,
            changefreq,
          })),
        }),
      })

      const data = (await response.json()) as SitemapResponse
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save sitemap settings")
      }

      setToast({ kind: "success", message: "Sitemap settings saved." })
    } catch (error) {
      setToast({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Failed to save sitemap settings",
      })
    } finally {
      setSaving(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  return (
    <div className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-4">
        {entries.map((entry) => (
          <div
            key={entry.pageSlug}
            className="grid gap-3 rounded-lg border border-slate-200 p-4 lg:grid-cols-[minmax(0,1.4fr)_auto_auto_auto]"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">{entry.title}</p>
              <p className="text-xs text-slate-500">{entry.pageSlug}</p>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={entry.include}
                onChange={(event) =>
                  updateEntry(entry.pageSlug, { include: event.target.checked })
                }
              />
              Include in sitemap
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-700">Priority</span>
              <select
                value={entry.priority.toFixed(1)}
                disabled={!entry.include}
                onChange={(event) =>
                  updateEntry(entry.pageSlug, { priority: Number(event.target.value) })
                }
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-700">Changefreq</span>
              <select
                value={entry.changefreq}
                disabled={!entry.include}
                onChange={(event) =>
                  updateEntry(entry.pageSlug, { changefreq: event.target.value })
                }
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                {CHANGEFREQ_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => void saveSettings()}
          disabled={saving}
          className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Sitemap Settings"}
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
