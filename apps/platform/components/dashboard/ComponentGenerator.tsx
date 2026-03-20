"use client"

import { javascript } from "@codemirror/lang-javascript"
import CodeMirror from "@uiw/react-codemirror"
import { useState } from "react"

interface ComponentGeneratorProps {
  initialComponents: Array<{
    id: string
    name: string
    description: string | null
    code: string
    approved: boolean
    createdAt: Date
  }>
}

interface ComponentListItem {
  id: string
  name: string
  description: string | null
  code: string
  approved: boolean
  createdAt: Date
  failReason?: string | null
}

interface GenerateComponentResponse {
  id?: string
  name?: string
  code?: string
  approved?: boolean
  failReason?: string | null
  error?: string
}

interface DeleteComponentResponse {
  success?: boolean
  error?: string
}

interface PatchComponentResponse {
  id?: string
  name?: string
  code?: string
  approved?: boolean
  failReason?: string | null
  error?: string
}

interface PreviewComponentResponse {
  safe?: boolean
  error?: string
}

function formatCreatedAt(createdAt: Date): string {
  return new Date(createdAt).toLocaleString()
}

export default function ComponentGenerator({ initialComponents }: ComponentGeneratorProps) {
  const [components, setComponents] = useState<ComponentListItem[]>(
    initialComponents.map((component) => ({ ...component, failReason: null }))
  )
  const [description, setDescription] = useState("")
  const [generating, setGenerating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editCode, setEditCode] = useState("")
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [previewResults, setPreviewResults] = useState<
    Record<string, { safe: boolean; error?: string }>
  >({})
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null)

  const generateComponent = async () => {
    setGenerating(true)
    setToast(null)

    try {
      const response = await fetch("/api/components/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ description }),
      })

      const data = (await response.json()) as GenerateComponentResponse
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate component")
      }

      if (
        typeof data.id !== "string" ||
        typeof data.name !== "string" ||
        typeof data.code !== "string" ||
        typeof data.approved !== "boolean"
      ) {
        throw new Error("Failed to generate component")
      }

      const nextComponent: ComponentListItem = {
        id: data.id,
        name: data.name,
        description: description.trim(),
        code: data.code,
        approved: data.approved,
        createdAt: new Date(),
        failReason: data.failReason ?? null,
      }

      setComponents((current) => [nextComponent, ...current])
      setDescription("")

      if (!data.approved) {
        setToast({
          kind: "error",
          message: data.failReason ?? "Component was saved but failed safety analysis.",
        })
        return
      }

      setToast({ kind: "success", message: "Component generated and saved to your library." })
    } catch (error) {
      setToast({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to generate component",
      })
    } finally {
      setGenerating(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  const deleteComponent = async (id: string) => {
    setDeleting(id)
    setToast(null)

    try {
      const response = await fetch(`/api/components/${id}`, {
        method: "DELETE",
      })

      const data = (await response.json()) as DeleteComponentResponse
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete component")
      }

      setComponents((current) => current.filter((component) => component.id !== id))
      setToast({ kind: "success", message: "Component deleted." })
    } catch (error) {
      setToast({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to delete component",
      })
    } finally {
      setDeleting(null)
      setTimeout(() => setToast(null), 3000)
    }
  }

  const saveEdit = async (componentId: string) => {
    setSaving(true)
    setToast(null)

    try {
      const response = await fetch(`/api/components/${componentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: editCode }),
      })
      const data = (await response.json()) as PatchComponentResponse
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save")
      }

      setComponents((prev) =>
        prev.map((component) =>
          component.id === componentId
            ? {
                ...component,
                code: data.code ?? component.code,
                approved: data.approved ?? component.approved,
                failReason: data.failReason ?? null,
              }
            : component
        )
      )
      setEditing(null)
      setToast({ kind: "success", message: "Component updated." })
    } catch (error) {
      setToast({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to save",
      })
    } finally {
      setSaving(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  const runPreview = async (componentId: string, code: string) => {
    setPreviewing(componentId)

    try {
      const response = await fetch("/api/components/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const data = (await response.json()) as PreviewComponentResponse
      setPreviewResults((prev) => ({
        ...prev,
        [componentId]: { safe: data.safe ?? false, error: data.error },
      }))
    } catch {
      setPreviewResults((prev) => ({
        ...prev,
        [componentId]: { safe: false, error: "Preview request failed" },
      }))
    } finally {
      setPreviewing(null)
    }
  }

  const trimmedLength = description.trim().length

  return (
    <div className="relative space-y-8">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label htmlFor="component-description" className="text-sm font-semibold text-slate-900">
          Describe your component
        </label>
        <p className="mt-2 text-sm text-slate-500">
          Explain the layout, content, and visual treatment you want. Claude will generate a presentational React component.
        </p>
        <textarea
          id="component-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          minLength={10}
          maxLength={500}
          rows={6}
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          placeholder="Build a testimonial section with three quote cards, customer headshots, and a centered heading."
        />
        <div className="mt-2 flex items-center justify-between gap-4">
          <p className="text-xs text-slate-500">{description.length}/500 characters</p>
          <button
            type="button"
            onClick={() => void generateComponent()}
            disabled={generating || trimmedLength < 10 || trimmedLength > 500}
            className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? "Generating..." : "Generate Component"}
          </button>
        </div>
      </section>

      <section className="space-y-4">
        {components.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            Your component library is empty. Generate your first component to get started.
          </div>
        ) : (
          components.map((component) => (
            <article
              key={component.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">{component.name}</h2>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        component.approved
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {component.approved ? "Approved" : "Rejected"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {component.description ?? "No description provided."}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Generated {formatCreatedAt(component.createdAt)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void deleteComponent(component.id)}
                  disabled={deleting === component.id}
                  className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleting === component.id ? "Deleting..." : "Delete"}
                </button>
              </div>

              <div className="mt-4 overflow-hidden rounded-md border border-slate-200 text-sm">
                <CodeMirror
                  value={editing === component.id ? editCode : component.code}
                  extensions={[javascript({ jsx: true, typescript: true })]}
                  editable={editing === component.id}
                  onChange={editing === component.id ? (value) => setEditCode(value) : undefined}
                  height="260px"
                  className="text-sm"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {editing === component.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void saveEdit(component.id)}
                      disabled={saving}
                      className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      disabled={saving}
                      className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(component.id)
                        setEditCode(component.code)
                      }}
                      className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void runPreview(component.id, component.code)}
                      disabled={previewing === component.id}
                      className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {previewing === component.id ? "Running..." : "Preview in Sandbox"}
                    </button>
                  </>
                )}
              </div>

              {previewResults[component.id] ? (
                <div
                  className={`mt-2 rounded-md border px-3 py-2 text-xs ${
                    previewResults[component.id].safe
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                  }`}
                >
                  {previewResults[component.id].safe
                    ? "Sandbox: passed"
                    : `Sandbox: ${previewResults[component.id].error ?? "failed"}`}
                </div>
              ) : null}

              {!component.approved && component.failReason ? (
                <p className="mt-3 text-xs text-rose-600">{component.failReason}</p>
              ) : null}
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
