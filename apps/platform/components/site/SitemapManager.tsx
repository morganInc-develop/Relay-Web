"use client"

import { useState } from "react"
import { toast } from "sonner"

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

  const updateEntry = (pageSlug: string, nextEntry: Partial<SitemapEntryState>) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.pageSlug === pageSlug ? { ...entry, ...nextEntry } : entry
      )
    )
  }

  const saveSettings = async () => {
    setSaving(true)

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

      toast.success("Sitemap settings saved.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save sitemap settings"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rw-card p-5">
      <div className="space-y-4">
        {entries.map((entry) => (
          <div
            key={entry.pageSlug}
            className="grid gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 lg:grid-cols-[minmax(0,1.4fr)_auto_auto_auto]"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">{entry.title}</p>
              <p className="text-xs text-[var(--text-secondary)]">{entry.pageSlug}</p>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
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
              <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Priority</span>
              <select
                value={entry.priority.toFixed(1)}
                disabled={!entry.include}
                onChange={(event) =>
                  updateEntry(entry.pageSlug, { priority: Number(event.target.value) })
                }
                className="rw-select disabled:cursor-not-allowed disabled:opacity-55"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Changefreq</span>
              <select
                value={entry.changefreq}
                disabled={!entry.include}
                onChange={(event) =>
                  updateEntry(entry.pageSlug, { changefreq: event.target.value })
                }
                className="rw-select disabled:cursor-not-allowed disabled:opacity-55"
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
          className="rw-btn rw-btn-primary"
        >
          {saving ? "Saving..." : "Save Sitemap Settings"}
        </button>
      </div>
    </div>
  )
}
