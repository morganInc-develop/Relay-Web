"use client"

import { useState } from "react"

interface ScheduledPublishProps {
  page: string
  field: string
  value: string
  onScheduled?: (isoDate: string) => void
}

export default function ScheduledPublish({
  page,
  field,
  value,
  onScheduled,
}: ScheduledPublishProps) {
  const [enabled, setEnabled] = useState(false)
  const [publishAt, setPublishAt] = useState("")
  const [isScheduling, setIsScheduling] = useState(false)
  const [scheduledFor, setScheduledFor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSchedule = async () => {
    if (!publishAt) return

    setIsScheduling(true)
    setError(null)
    try {
      const res = await fetch("/api/content/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, field, value, publishAt }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Failed to schedule update")

      const iso = String(data.scheduledFor ?? new Date(publishAt).toISOString())
      setScheduledFor(iso)
      setEnabled(false)
      onScheduled?.(iso)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule update")
    } finally {
      setIsScheduling(false)
    }
  }

  if (scheduledFor) {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200">
        Scheduled for {new Date(scheduledFor).toLocaleString()}
      </span>
    )
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          setEnabled((prev) => !prev)
          setError(null)
        }}
        className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
      >
        {enabled ? "Cancel scheduling" : "Schedule for later"}
      </button>

      {enabled && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={publishAt}
            onChange={(e) => setPublishAt(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={handleSchedule}
            disabled={isScheduling || !publishAt}
            className="text-xs bg-gray-900 text-white rounded-md px-2.5 py-1.5 hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {isScheduling ? "Scheduling..." : "Schedule"}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
