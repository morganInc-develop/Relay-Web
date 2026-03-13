"use client"

import { useState, useRef, useEffect } from "react"
import { Send, CheckCircle, XCircle, Bot, User, AlertTriangle } from "lucide-react"

interface AIResponse {
  action: string
  pageSlug: string | null
  pageId: string | null
  fieldKey: string | null
  newValue: string | null
  humanMessage: string
  requiresConfirmation: boolean
  confidenceScore: number
  usage?: { used: number; limit: number | null }
}

interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  aiResponse?: AIResponse
  status?: "pending" | "applied" | "rejected"
}

interface AIChatInterfaceProps {
  siteId: string
  monthlyRemaining: number | null
}

export default function AIChatInterface({
  siteId,
  monthlyRemaining,
}: AIChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "system",
      content:
        "Hi! I can help you update your website content. Try asking me something like: \"Change the hero heading to Welcome to Our Studio\" or \"Update the meta description for the home page to describe our services.\"",
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isApplying, setIsApplying] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, message: userMessage.content }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status !== 429) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: data.error ?? "Something went wrong. Please try again.",
            },
          ])
        }
        return
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.humanMessage,
        aiResponse: data,
        status: data.requiresConfirmation && data.action !== "no-action" ? "pending" : undefined,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Failed to reach the AI assistant. Please try again.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  async function handleApprove(messageId: string, aiResponse: AIResponse) {
    if (!aiResponse.pageId || !aiResponse.pageSlug || !aiResponse.fieldKey || !aiResponse.newValue) {
      return
    }

    setIsApplying(messageId)

    try {
      const lastUserPrompt = [...messages].reverse().find((m) => m.role === "user")?.content ?? ""

      const res = await fetch("/api/ai/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          pageId: aiResponse.pageId,
          pageSlug: aiResponse.pageSlug,
          fieldKey: aiResponse.fieldKey,
          newValue: aiResponse.newValue,
          userPrompt: lastUserPrompt,
        }),
      })

      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, status: "applied" } : m
          )
        )
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "system",
            content: `✓ Change applied. Your site is rebuilding and will be live within 60 seconds.`,
          },
        ])
      } else {
        const data = await res.json()
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "system",
            content: `Failed to apply change: ${data.error ?? "Unknown error"}`,
          },
        ])
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "system",
          content: "Failed to apply change. Please try again.",
        },
      ])
    } finally {
      setIsApplying(null)
    }
  }

  async function handleReject(messageId: string, aiResponse: AIResponse) {
    const lastUserPrompt = [...messages].reverse().find((m) => m.role === "user")?.content ?? ""

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, status: "rejected" } : m
      )
    )

    await fetch("/api/ai/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId,
        pageSlug: aiResponse.pageSlug ?? "unknown",
        fieldKey: aiResponse.fieldKey,
        newValue: aiResponse.newValue,
        userPrompt: lastUserPrompt,
      }),
    }).catch(() => {})
  }

  const isAtLimit = monthlyRemaining !== null && monthlyRemaining <= 0

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div key={message.id}>
            {/* System message */}
            {message.role === "system" && (
              <div className="flex justify-center">
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600 max-w-lg text-center">
                  {message.content}
                </div>
              </div>
            )}

            {/* User message */}
            {message.role === "user" && (
              <div className="flex justify-end gap-3">
                <div className="bg-gray-900 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-md text-sm">
                  {message.content}
                </div>
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-gray-600" />
                </div>
              </div>
            )}

            {/* Assistant message */}
            {message.role === "assistant" && (
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 max-w-md">
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-800">
                    {message.content}
                  </div>

                  {/* Confirmation UI */}
                  {message.status === "pending" && message.aiResponse && (
                    <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <div className="flex items-start gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800">
                          <p className="font-medium mb-1">Confirm this change</p>
                          <p className="text-blue-600 text-xs">
                            Field: <code className="bg-blue-100 px-1 rounded">{message.aiResponse.fieldKey}</code>
                            {" "}on page: <code className="bg-blue-100 px-1 rounded">{message.aiResponse.pageSlug}</code>
                          </p>
                          {message.aiResponse.newValue && (
                            <p className="text-blue-600 text-xs mt-1">
                              New value: &ldquo;{message.aiResponse.newValue}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(message.id, message.aiResponse!)}
                          disabled={isApplying === message.id}
                          className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle className="w-4 h-4" />
                          {isApplying === message.id ? "Applying..." : "Apply change"}
                        </button>
                        <button
                          onClick={() => handleReject(message.id, message.aiResponse!)}
                          disabled={isApplying === message.id}
                          className="flex items-center gap-1.5 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Applied state */}
                  {message.status === "applied" && (
                    <div className="mt-2 flex items-center gap-1.5 text-green-600 text-xs font-medium">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Change applied
                    </div>
                  )}

                  {/* Rejected state */}
                  {message.status === "rejected" && (
                    <div className="mt-2 flex items-center gap-1.5 text-gray-400 text-xs">
                      <XCircle className="w-3.5 h-3.5" />
                      Dismissed
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-gray-200 p-4">
        {isAtLimit ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
            <p className="text-amber-800 text-sm font-medium">Monthly limit reached</p>
            <p className="text-amber-600 text-xs mt-0.5">
              Upgrade your plan for more AI requests, or wait until next month.
            </p>
          </div>
        ) : (
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Describe a change e.g. Change the hero heading to..."
              disabled={isLoading}
              maxLength={500}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="bg-gray-900 text-white p-2.5 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
        {monthlyRemaining !== null && monthlyRemaining > 0 && monthlyRemaining <= 10 && (
          <p className="text-amber-600 text-xs mt-2 text-center">
            {monthlyRemaining} AI request{monthlyRemaining === 1 ? "" : "s"} remaining this month
          </p>
        )}
      </div>
    </div>
  )
}
