"use client"

import { useState } from "react"

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
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(
    null
  )

  const addScript = async () => {
    setAdding(true)
    setToast(null)

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
      setToast({ kind: "success", message: "Script added." })
    } catch (error) {
      setToast({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to add script",
      })
    } finally {
      setAdding(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  const deleteScript = async (id: string) => {
    setDeletingId(id)
    setToast(null)

    try {
      const response = await fetch(`/api/site/scripts/${id}`, {
        method: "DELETE",
      })
      const data = (await response.json()) as DeleteScriptResponse
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete script")
      }

      setScripts((prev) => prev.filter((script) => script.id !== id))
      setToast({ kind: "success", message: "Script deleted." })
    } catch (error) {
      setToast({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to delete script",
      })
    } finally {
      setDeletingId(null)
      setTimeout(() => setToast(null), 3000)
    }
  }

  return (
    <div className="relative space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
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
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
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
            <span className="mb-1 block text-xs font-medium text-slate-700">Name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-700">Placement</span>
            <select
              value={placement}
              onChange={(event) => setPlacement(event.target.value as "head" | "body")}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="head">head</option>
              <option value="body">body</option>
            </select>
          </label>

          {mode === "src" ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-700">Script URL</span>
              <input
                type="url"
                value={src}
                onChange={(event) => setSrc(event.target.value)}
                placeholder="https://cdn.example.com/script.js"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </label>
          ) : null}

          {mode === "content" ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-700">Inline Script</span>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                maxLength={5000}
                rows={6}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              <span className="mt-1 block text-xs text-slate-500">{content.length}/5000 characters</span>
            </label>
          ) : null}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => void addScript()}
            disabled={adding}
            className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {adding ? "Adding..." : "Add Script"}
          </button>
        </div>
      </section>

      <section className="space-y-4">
        {scripts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            No custom scripts added yet.
          </div>
        ) : (
          scripts.map((script) => (
            <article
              key={script.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">{script.name}</h3>
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {script.placement}
                    </span>
                  </div>
                  <p className="mt-2 break-all text-sm text-slate-500">
                    {script.src ??
                      `${(script.content ?? "").slice(0, 80)}${
                        (script.content ?? "").length > 80 ? "..." : ""
                      }`}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Added {formatCreatedAt(script.createdAt)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void deleteScript(script.id)}
                  disabled={deletingId === script.id}
                  className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingId === script.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </article>
          ))
        )}
      </section>

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
