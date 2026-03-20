"use client"

import { javascript } from "@codemirror/lang-javascript"
import CodeMirror from "@uiw/react-codemirror"
import { useState } from "react"
import { toast } from "sonner"

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

  const generateComponent = async () => {
    setGenerating(true)
    const toastId = toast.loading("Generating component with AI...")

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
        toast.error(data.failReason ?? "Component was saved but failed safety analysis.", {
          id: toastId,
        })
        return
      }

      toast.success("Component generated and saved to your library.", { id: toastId })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate component", {
        id: toastId,
      })
    } finally {
      setGenerating(false)
    }
  }

  const deleteComponent = async (id: string) => {
    setDeleting(id)

    try {
      const response = await fetch(`/api/components/${id}`, {
        method: "DELETE",
      })

      const data = (await response.json()) as DeleteComponentResponse
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete component")
      }

      setComponents((current) => current.filter((component) => component.id !== id))
      toast.success("Component deleted.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete component")
    } finally {
      setDeleting(null)
    }
  }

  const saveEdit = async (componentId: string) => {
    setSaving(true)

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
      toast.success("Component updated.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const runPreview = async (componentId: string, code: string) => {
    setPreviewing(componentId)
    const toastId = toast.loading("Running sandbox preview...")

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
      toast[data.safe ? "success" : "error"](
        data.safe ?? false ? "Sandbox preview passed." : data.error ?? "Sandbox preview failed.",
        { id: toastId }
      )
    } catch {
      setPreviewResults((prev) => ({
        ...prev,
        [componentId]: { safe: false, error: "Preview request failed" },
      }))
      toast.error("Preview request failed", { id: toastId })
    } finally {
      setPreviewing(null)
    }
  }

  const trimmedLength = description.trim().length

  return (
    <div className="space-y-8">
      <section className="rw-card p-5">
        <label htmlFor="component-description" className="text-sm font-semibold text-[var(--text-primary)]">
          Describe your component
        </label>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Explain the layout, content, and visual treatment you want. Claude will generate a presentational React component.
        </p>
        <textarea
          id="component-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          minLength={10}
          maxLength={500}
          rows={6}
          className="rw-textarea mt-4"
          placeholder="Build a testimonial section with three quote cards, customer headshots, and a centered heading."
        />
        <div className="mt-2 flex items-center justify-between gap-4">
          <p className="text-xs text-[var(--text-secondary)]">{description.length}/500 characters</p>
          <button
            type="button"
            onClick={() => void generateComponent()}
            disabled={generating || trimmedLength < 10 || trimmedLength > 500}
            className="rw-btn rw-btn-primary"
          >
            {generating ? "Generating..." : "Generate Component"}
          </button>
        </div>
      </section>

      <section className="space-y-4">
        {components.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)] p-6 text-sm text-[var(--text-secondary)]">
            Your component library is empty. Generate your first component to get started.
          </div>
        ) : (
          components.map((component) => (
            <article
              key={component.id}
              className="rw-card p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">{component.name}</h2>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        component.approved
                          ? "bg-[var(--success-bg)] text-[var(--success)]"
                          : "bg-[var(--error-bg)] text-[var(--error)]"
                      }`}
                    >
                      {component.approved ? "Approved" : "Rejected"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    {component.description ?? "No description provided."}
                  </p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    Generated {formatCreatedAt(component.createdAt)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void deleteComponent(component.id)}
                  disabled={deleting === component.id}
                  className="rw-btn rw-btn-secondary"
                >
                  {deleting === component.id ? "Deleting..." : "Delete"}
                </button>
              </div>

              <div className="mt-4 overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--bg-overlay)] text-sm">
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
                      className="rw-btn rw-btn-secondary"
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      disabled={saving}
                      className="rw-btn rw-btn-secondary"
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
                      className="rw-btn rw-btn-secondary"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void runPreview(component.id, component.code)}
                      disabled={previewing === component.id}
                      className="rw-btn rw-btn-secondary"
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
                      ? "border-[color:rgba(34,197,94,0.3)] bg-[var(--success-bg)] text-[var(--success)]"
                      : "border-[color:rgba(239,68,68,0.3)] bg-[var(--error-bg)] text-[var(--error)]"
                  }`}
                >
                  {previewResults[component.id].safe
                    ? "Sandbox: passed"
                    : `Sandbox: ${previewResults[component.id].error ?? "failed"}`}
                </div>
              ) : null}

              {!component.approved && component.failReason ? (
                <p className="mt-3 text-xs text-[var(--error)]">{component.failReason}</p>
              ) : null}
            </article>
          ))
        )}
      </section>
    </div>
  )
}
