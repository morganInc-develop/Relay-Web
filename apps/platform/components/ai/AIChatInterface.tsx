"use client"

import { useEffect, useMemo, useState } from "react"

type ProposedAction = {
  action: "update-text" | "update-seo"
  page: string
  field: string
  value: string
  reasoning: string
}

type UsageResponse = {
  dailyUsed: number
  dailyLimit?: number | null
  monthlyUsed: number
  monthlyLimit?: number | null
  dailyCap?: number | null
  monthlyCap?: number | null
}

type ThreadMessage = {
  id: string
  role: "user" | "assistant"
  content: string
}

type FeedbackState =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | { type: "blocked"; message: string }
  | { type: "out-of-scope"; message: string }
  | null

export default function AIChatInterface() {
  const [thread, setThread] = useState<ThreadMessage[]>([])
  const [message, setMessage] = useState("")
  const [usage, setUsage] = useState<UsageResponse | null>(null)
  const [pendingProposal, setPendingProposal] = useState<{ logId: string; proposal: ProposedAction } | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState>(null)

  const usageSummary = useMemo(() => {
    if (!usage) return "Loading usage..."
    const dailyLimit = usage.dailyLimit ?? usage.dailyCap ?? null
    const monthlyLimit = usage.monthlyLimit ?? usage.monthlyCap ?? null

    if (dailyLimit === null && monthlyLimit === null) {
      return "Unlimited"
    }

    const dailySegment =
      dailyLimit === null ? `Today: ${usage.dailyUsed}/Unlimited` : `Today: ${usage.dailyUsed}/${dailyLimit}`
    const monthlySegment =
      monthlyLimit === null
        ? `This month: ${usage.monthlyUsed}/Unlimited`
        : `This month: ${usage.monthlyUsed}/${monthlyLimit}`

    return `${dailySegment} · ${monthlySegment}`
  }, [usage])

  const characterCount = message.length

  const appendMessage = (role: "user" | "assistant", content: string) => {
    setThread((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        role,
        content,
      },
    ])
  }

  async function loadUsage() {
    const response = await fetch("/api/ai/usage", { cache: "no-store" })
    const data = (await response.json()) as UsageResponse & { error?: string }
    if (!response.ok) {
      throw new Error(data.error ?? "Failed to load usage")
    }
    setUsage(data)
  }

  useEffect(() => {
    void loadUsage().catch((error) => {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to load usage",
      })
    })
  }, [])

  async function sendMessage() {
    const trimmed = message.trim()
    if (!trimmed || loading || confirming || rejecting || pendingProposal) return

    setFeedback(null)
    setLoading(true)
    appendMessage("user", trimmed)

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      })

      const data = (await response.json()) as {
        error?: string
        message?: string
        upsell?: boolean
        action?: string
        logId?: string
        proposedAction?: ProposedAction
      }

      if (!response.ok) {
        const errorMessage = data.error ?? "Failed to send request"
        const blocked = response.status === 400 && /blocked/i.test(errorMessage)
        setFeedback({
          type: blocked ? "blocked" : "error",
          message: blocked ? "Message not allowed. Please rephrase your request." : errorMessage,
        })
        return
      }

      if (data.proposedAction && data.logId) {
        setPendingProposal({ logId: data.logId, proposal: data.proposedAction })
        appendMessage(
          "assistant",
          `I can ${data.proposedAction.action} on ${data.proposedAction.page}.${data.proposedAction.field}: ${data.proposedAction.reasoning}`
        )
        setMessage("")
        await loadUsage()
        return
      }

      if (data.action === "out-of-scope" || data.upsell) {
        const outOfScopeMessage =
          data.message ??
          "This request is outside what I can help with. Email hello@morgandev.studio for assistance."
        setPendingProposal(null)
        setFeedback({ type: "out-of-scope", message: outOfScopeMessage })
        appendMessage("assistant", outOfScopeMessage)
        setMessage("")
        await loadUsage()
        return
      }

      setFeedback({ type: "error", message: "Invalid AI response" })
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to send request",
      })
    } finally {
      setLoading(false)
    }
  }

  async function confirmProposal() {
    if (!pendingProposal || confirming || rejecting) return

    setConfirming(true)
    setFeedback(null)

    try {
      const response = await fetch("/api/ai/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: pendingProposal.logId }),
      })

      const data = (await response.json()) as { error?: string; fieldAfter?: string }
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to apply proposal")
      }

      appendMessage(
        "assistant",
        `Applied ${pendingProposal.proposal.field} on ${pendingProposal.proposal.page}.`
      )
      setFeedback({ type: "success", message: "Change applied successfully." })
      setPendingProposal(null)
      await loadUsage()
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to apply proposal",
      })
    } finally {
      setConfirming(false)
    }
  }

  async function rejectProposal() {
    if (!pendingProposal || confirming || rejecting) return

    setRejecting(true)
    try {
      const response = await fetch("/api/ai/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: pendingProposal.logId }),
      })

      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to reject proposal")
      }

      appendMessage("assistant", "Proposal rejected.")
      setFeedback({ type: "success", message: "Proposal rejected." })
      setPendingProposal(null)
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to reject proposal",
      })
    } finally {
      setRejecting(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-800">AI Assistant</p>
        <p className="text-xs text-gray-500">{usageSummary}</p>
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
        {thread.length === 0 ? (
          <p className="text-xs text-gray-500">Ask for a content or SEO change to start.</p>
        ) : (
          thread.map((entry) => (
            <div
              key={entry.id}
              className={`max-w-[90%] rounded-md px-3 py-2 text-xs ${
                entry.role === "user"
                  ? "ml-auto bg-gray-900 text-white"
                  : "mr-auto border border-gray-200 bg-white text-gray-800"
              }`}
            >
              {entry.content}
            </div>
          ))
        )}
      </div>

      <div className="space-y-3">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value.slice(0, 1000))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              void sendMessage()
            }
          }}
          rows={4}
          maxLength={1000}
          placeholder="Describe the change in plain English..."
          disabled={loading || confirming || rejecting || Boolean(pendingProposal)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />

        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">{characterCount}/1000</p>
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={!message.trim() || loading || confirming || rejecting || Boolean(pendingProposal)}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "Thinking..." : "Send"}
          </button>
        </div>
      </div>

      {pendingProposal && (
        <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-900">Confirm this proposal</p>
          <p className="text-xs text-blue-800">
            <strong>Action:</strong> {pendingProposal.proposal.action}
          </p>
          <p className="text-xs text-blue-800">
            <strong>Page:</strong> {pendingProposal.proposal.page}
          </p>
          <p className="text-xs text-blue-800">
            <strong>Field:</strong> {pendingProposal.proposal.field}
          </p>
          <p className="text-xs text-blue-800">
            <strong>Value:</strong> {pendingProposal.proposal.value}
          </p>
          <p className="text-xs text-blue-800">
            <strong>Reasoning:</strong> {pendingProposal.proposal.reasoning}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void confirmProposal()}
              disabled={confirming || rejecting}
              className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              {confirming ? "Confirming..." : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => void rejectProposal()}
              disabled={confirming || rejecting}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700"
            >
              {rejecting ? "Rejecting..." : "Reject"}
            </button>
          </div>
        </div>
      )}

      {feedback?.type === "success" && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {feedback.message}
        </div>
      )}

      {feedback?.type === "error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {feedback.message}
        </div>
      )}

      {feedback?.type === "blocked" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Message not allowed. Please rephrase your request.
        </div>
      )}

      {feedback?.type === "out-of-scope" && (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p>{feedback.message}</p>
          <a href="mailto:hello@morgandev.studio" className="text-xs font-medium underline">
            hello@morgandev.studio
          </a>
        </div>
      )}
    </div>
  )
}
