"use client"

import { useState } from "react"

interface ScheduledPublishProps {
  page: string
  field: string
  value: string
}

type ScheduleState =
  | { status: "idle" }
  | { status: "open"; publishAt: string }
  | { status: "scheduling" }
  | { status: "scheduled"; publishAt: string; id: string }
  | { status: "error"; message: string }

interface ScheduleResponse {
  success?: boolean
  scheduledAt?: string
  id?: string
  error?: string
}

function toDatetimeLocal(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export default function ScheduledPublish({ page, field, value }: ScheduledPublishProps) {
  const [state, setState] = useState<ScheduleState>({ status: "idle" })
  const [pendingPublishAt, setPendingPublishAt] = useState("")

  const minimumPublishAt = toDatetimeLocal(new Date(Date.now() + 5 * 60 * 1000))

  const startScheduling = () => {
    const initialDate = minimumPublishAt
    setPendingPublishAt(initialDate)
    setState({ status: "open", publishAt: initialDate })
  }

  const submitSchedule = async () => {
    if (state.status !== "open") return

    const publishAt = state.publishAt
    if (!publishAt) {
      setState({ status: "error", message: "Pick a publish date and time." })
      return
    }

    setPendingPublishAt(publishAt)
    setState({ status: "scheduling" })

    try {
      const response = await fetch("/api/content/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, field, value, publishAt: new Date(publishAt).toISOString() }),
      })

      const data = (await response.json()) as ScheduleResponse

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to schedule update")
      }

      const scheduledAt = typeof data.scheduledAt === "string" ? data.scheduledAt : publishAt
      setState({
        status: "scheduled",
        publishAt: scheduledAt,
        id: typeof data.id === "string" ? data.id : "",
      })
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to schedule update",
      })
    }
  }

  if (state.status === "scheduled") {
    return (
      <span className="rw-pill">
        Scheduled for {new Date(state.publishAt).toLocaleString()}
        <button type="button" onClick={() => setState({ status: "idle" })} aria-label="Clear schedule badge">
          ×
        </button>
      </span>
    )
  }

  return (
    <div className="space-y-2">
      {(state.status === "idle" || state.status === "error") && (
        <button
          type="button"
          onClick={startScheduling}
          className="text-xs text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
        >
          Schedule for later
        </button>
      )}

      {state.status === "open" && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            min={minimumPublishAt}
            value={state.publishAt}
            onChange={(event) => setState({ status: "open", publishAt: event.target.value })}
            className="rw-input w-auto min-w-60 px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={() => void submitSchedule()}
            className="rw-btn rw-btn-primary px-2.5 py-1.5 text-xs"
          >
            Schedule
          </button>
          <button
            type="button"
            onClick={() => setState({ status: "idle" })}
            className="text-xs text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
          >
            Cancel
          </button>
        </div>
      )}

      {state.status === "scheduling" && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            min={minimumPublishAt}
            value={pendingPublishAt}
            disabled
            className="rw-input w-auto min-w-60 px-2 py-1.5 text-xs opacity-70"
          />
          <button
            type="button"
            disabled
            className="rw-btn rw-btn-primary px-2.5 py-1.5 text-xs opacity-70"
          >
            Scheduling...
          </button>
        </div>
      )}

      {state.status === "error" && (
        <div className="space-y-1">
          <p className="text-xs text-[var(--error)]">{state.message}</p>
          <button
            type="button"
            onClick={startScheduling}
            className="text-xs text-[var(--error)] underline"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
