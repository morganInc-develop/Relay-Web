"use client"

import { useEffect, useState } from "react"
import { RiCloseCircleLine, RiRefreshLine } from "react-icons/ri"
import { toast } from "sonner"

interface ScheduledChangesListProps {
  page: string
  refreshKey: number
}

interface ScheduledChangeRecord {
  id: string
  page: string
  field: string
  value: string
  publishAt: string
  status: string
  createdAt: string
}

interface ScheduledChangesResponse {
  scheduledChanges?: ScheduledChangeRecord[]
  error?: string
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString()
}

function previewValue(value: string): string {
  if (value.length <= 90) return value
  return `${value.slice(0, 90)}...`
}

export default function ScheduledChangesList({ page, refreshKey }: ScheduledChangesListProps) {
  const [records, setRecords] = useState<ScheduledChangeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [manualRefreshKey, setManualRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadScheduledChanges() {
      if (!page) return

      setLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/content/scheduled?page=${encodeURIComponent(page)}`,
          { cache: "no-store" }
        )
        const data = (await response.json()) as ScheduledChangesResponse

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load scheduled changes")
        }

        if (!cancelled) {
          setRecords(data.scheduledChanges ?? [])
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load scheduled changes")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadScheduledChanges()

    return () => {
      cancelled = true
    }
  }, [page, refreshKey, manualRefreshKey])

  const cancelSchedule = async (id: string) => {
    setCancelingId(id)
    const toastId = toast.loading("Canceling scheduled change...")

    try {
      const response = await fetch(`/api/content/scheduled/${id}`, {
        method: "DELETE",
      })
      const data = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to cancel scheduled change")
      }

      setRecords((current) => current.filter((record) => record.id !== id))
      toast.success("Scheduled change canceled.", { id: toastId })
    } catch (cancelError) {
      toast.error(
        cancelError instanceof Error ? cancelError.message : "Failed to cancel scheduled change",
        { id: toastId }
      )
    } finally {
      setCancelingId(null)
    }
  }

  return (
    <section className="rw-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Scheduled Changes</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Review pending updates for the selected page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setManualRefreshKey((current) => current + 1)}
          className="rw-btn rw-btn-secondary w-fit px-3 py-1.5 text-xs"
        >
          <RiRefreshLine className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-500)]" />
          Loading scheduled changes...
        </div>
      ) : null}

      {!loading && error ? (
        <p className="mt-5 text-sm text-[var(--error)]">{error}</p>
      ) : null}

      {!loading && !error && records.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 text-sm text-[var(--text-secondary)]">
          No scheduled changes for this page.
        </div>
      ) : null}

      {!loading && !error && records.length > 0 ? (
        <div className="mt-5 overflow-hidden rounded-lg border border-[var(--border-subtle)]">
          <div className="hidden border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)] md:grid md:grid-cols-[1fr_1fr_auto_auto]">
            <span>Field</span>
            <span>Value</span>
            <span>Publish At</span>
            <span>Status</span>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {records.map((record) => (
              <div
                key={record.id}
                className="grid gap-3 bg-[var(--bg-surface)] px-4 py-4 text-sm md:grid-cols-[1fr_1fr_auto_auto]"
              >
                <div>
                  <p className="font-medium text-[var(--text-primary)]">{record.field}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{record.page}</p>
                </div>
                <p className="text-[var(--text-secondary)]">{previewValue(record.value)}</p>
                <p className="text-[var(--text-secondary)]">{formatDate(record.publishAt)}</p>
                <div className="flex items-center gap-2 md:justify-end">
                  <span className="rw-badge">{record.status}</span>
                  {record.status === "SCHEDULED" ? (
                    <button
                      type="button"
                      onClick={() => void cancelSchedule(record.id)}
                      disabled={cancelingId === record.id}
                      aria-label={`Cancel scheduled change for ${record.field}`}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-default)] text-[var(--text-muted)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--error)] disabled:opacity-50"
                    >
                      <RiCloseCircleLine className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
