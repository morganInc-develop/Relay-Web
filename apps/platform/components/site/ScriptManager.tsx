"use client"

import { useState } from "react"
import { toast } from "sonner"

interface ScriptManagerProps {
  initialScripts: Array<{
    id: string
    name: string
    src: string | null
    content: string | null
    placement: string
    createdAt: Date
  }>
}

interface ScriptRecord {
  id: string
  name: string
  src: string | null
  content: string | null
  placement: string
  createdAt: Date
}

interface ScriptApiRecord {
  id: string
  name: string
  src: string | null
  content: string | null
  placement: string
  createdAt: string | Date
}

interface CreateScriptResponse {
  script?: ScriptApiRecord
  error?: string
}

interface DeleteScriptResponse {
  success?: boolean
  error?: string
}

function formatCreatedAt(createdAt: Date): string {
  return new Date(createdAt).toLocaleString()
}

export default function ScriptManager({ initialScripts }: ScriptManagerProps) {
  const [scripts, setScripts] = useState<ScriptRecord[]>(initialScripts)
  const [name, setName] = useState("")
  const [src, setSrc] = useState("")
  const [content, setContent] = useState("")
  const [placement, setPlacement] = useState<"head" | "body">("head")
  const [mode, setMode] = useState<"src" | "content">("src")
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const addScript = async () => {
    setAdding(true)

    try {
      const response = await fetch("/api/site/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          src: mode === "src" ? src : "",
          content: mode === "content" ? content : "",
          placement,
        }),
      })
      const data = (await response.json()) as CreateScriptResponse
      if (!response.ok || !data.script) {
        throw new Error(data.error ?? "Failed to add script")
      }

      const nextScript: ScriptRecord = {
        id: data.script.id,
        name: data.script.name,
        src: data.script.src,
        content: data.script.content,
        placement: data.script.placement,
        createdAt: new Date(data.script.createdAt),
      }

      setScripts((prev) => [
        nextScript,
        ...prev,
      ])
      setName("")
      setSrc("")
      setContent("")
      setPlacement("head")
      setMode("src")
      toast.success("Script added.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add script")
    } finally {
      setAdding(false)
    }
  }

  const deleteScript = async (id: string) => {
    setDeletingId(id)

    try {
      const response = await fetch(`/api/site/scripts/${id}`, {
        method: "DELETE",
      })
      const data = (await response.json()) as DeleteScriptResponse
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete script")
      }

      setScripts((prev) => prev.filter((script) => script.id !== id))
      toast.success("Script deleted.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete script")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rw-card p-5">
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="radio"
              name="script-mode"
              checked={mode === "src"}
              onChange={() => {
                setMode("src")
                setContent("")
              }}
            />
            External URL
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="radio"
              name="script-mode"
              checked={mode === "content"}
              onChange={() => {
                setMode("content")
                setSrc("")
              }}
            />
            Inline Script
          </label>
        </div>

        <div className="mt-4 grid gap-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rw-input"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Placement</span>
            <select
              value={placement}
              onChange={(event) => setPlacement(event.target.value as "head" | "body")}
              className="rw-select"
            >
              <option value="head">head</option>
              <option value="body">body</option>
            </select>
          </label>

          {mode === "src" ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Script URL</span>
              <input
                type="url"
                value={src}
                onChange={(event) => setSrc(event.target.value)}
                placeholder="https://cdn.example.com/script.js"
                className="rw-input"
              />
            </label>
          ) : null}

          {mode === "content" ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Inline Script</span>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                maxLength={5000}
                rows={6}
                className="rw-textarea"
              />
              <span className="mt-1 block text-xs text-[var(--text-secondary)]">{content.length}/5000 characters</span>
            </label>
          ) : null}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => void addScript()}
            disabled={adding}
            className="rw-btn rw-btn-primary"
          >
            {adding ? "Adding..." : "Add Script"}
          </button>
        </div>
      </section>

      <section className="space-y-4">
        {scripts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)] p-6 text-sm text-[var(--text-secondary)]">
            No custom scripts added yet.
          </div>
        ) : (
          scripts.map((script) => (
            <article
              key={script.id}
              className="rw-card p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{script.name}</h3>
                    <span className="rw-pill">
                      {script.placement}
                    </span>
                  </div>
                  <p className="mt-2 break-all text-sm text-[var(--text-secondary)]">
                    {script.src ??
                      `${(script.content ?? "").slice(0, 80)}${
                        (script.content ?? "").length > 80 ? "..." : ""
                      }`}
                  </p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    Added {formatCreatedAt(script.createdAt)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void deleteScript(script.id)}
                  disabled={deletingId === script.id}
                  className="rw-btn rw-btn-secondary"
                >
                  {deletingId === script.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  )
}
