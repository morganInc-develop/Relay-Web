"use client"

import { useEffect, useMemo, useState } from "react"
import {
  RiAlertLine,
  RiCheckboxCircleLine,
  RiMailLine,
  RiRobot2Line,
  RiSendPlaneLine,
  RiShieldCheckLine,
} from "react-icons/ri"

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RiRobot2Line className="h-4 w-4 text-[var(--accent-500)]" />
          <p className="text-sm font-medium text-[var(--text-primary)]">AI Assistant</p>
        </div>
        <p className="text-xs text-[var(--text-secondary)]">{usageSummary}</p>
      </div>

      <div className="rw-scrollbar max-h-72 space-y-2 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
        {thread.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)]">Ask for a content or SEO change to start.</p>
        ) : (
          thread.map((entry) => (
            <div
              key={entry.id}
              className={`max-w-[90%] rounded-md px-3 py-2 text-xs ${
                entry.role === "user"
                  ? "ml-auto bg-[var(--accent-500)] text-white"
                  : "mr-auto border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
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
          className="rw-textarea min-h-[120px]"
        />

        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--text-secondary)]">{characterCount}/1000</p>
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={!message.trim() || loading || confirming || rejecting || Boolean(pendingProposal)}
            className="rw-btn rw-btn-primary"
          >
            {!loading ? <RiSendPlaneLine className="h-4 w-4" /> : null}
            {loading ? "Thinking..." : "Send"}
          </button>
        </div>
      </div>

      {pendingProposal && (
        <div className="space-y-3 rounded-xl border border-[color:rgba(96,165,250,0.24)] bg-[color:rgba(59,130,246,0.12)] p-4">
          <div className="flex items-center gap-2">
            <RiShieldCheckLine className="h-4 w-4 text-[var(--accent-500)]" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">Confirm this proposal</p>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            <strong>Action:</strong> {pendingProposal.proposal.action}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            <strong>Page:</strong> {pendingProposal.proposal.page}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            <strong>Field:</strong> {pendingProposal.proposal.field}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            <strong>Value:</strong> {pendingProposal.proposal.value}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            <strong>Reasoning:</strong> {pendingProposal.proposal.reasoning}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void confirmProposal()}
              disabled={confirming || rejecting}
              className="rw-btn rw-btn-primary px-3 py-1.5 text-xs"
            >
              {!confirming ? <RiCheckboxCircleLine className="h-4 w-4" /> : null}
              {confirming ? "Confirming..." : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => void rejectProposal()}
              disabled={confirming || rejecting}
              className="rw-btn rw-btn-secondary px-3 py-1.5 text-xs"
            >
              {rejecting ? "Rejecting..." : "Reject"}
            </button>
          </div>
        </div>
      )}

      {feedback?.type === "success" && (
        <div className="flex items-center gap-2 rounded-lg border border-[color:rgba(34,197,94,0.28)] bg-[var(--success-bg)] p-3 text-sm text-[var(--success)]">
          <RiCheckboxCircleLine className="h-4 w-4" />
          {feedback.message}
        </div>
      )}

      {feedback?.type === "error" && (
        <div className="flex items-center gap-2 rounded-lg border border-[color:rgba(239,68,68,0.28)] bg-[var(--error-bg)] p-3 text-sm text-[var(--error)]">
          <RiAlertLine className="h-4 w-4" />
          {feedback.message}
        </div>
      )}

      {feedback?.type === "blocked" && (
        <div className="flex items-center gap-2 rounded-lg border border-[color:rgba(239,68,68,0.28)] bg-[var(--error-bg)] p-3 text-sm text-[var(--error)]">
          <RiAlertLine className="h-4 w-4" />
          Message not allowed. Please rephrase your request.
        </div>
      )}

      {feedback?.type === "out-of-scope" && (
        <div className="space-y-2 rounded-lg border border-[color:rgba(245,158,11,0.28)] bg-[var(--warning-bg)] p-3 text-sm text-[var(--warning)]">
          <p>{feedback.message}</p>
          <a href="mailto:hello@morgandev.studio" className="inline-flex items-center gap-1 text-xs font-medium underline">
            <RiMailLine className="h-4 w-4" />
            hello@morgandev.studio
          </a>
        </div>
      )}
    </div>
  )
}
