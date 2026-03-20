"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

interface StructuredDataEditorProps {
  initialSchema: Record<string, unknown> | null
  pageSlug: string
}

interface StructuredDataResponse {
  success?: boolean
  error?: string
}

const STARTER_TEMPLATE: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "",
  url: "",
}

function formatEditorValue(schema: Record<string, unknown> | null): string {
  return JSON.stringify(schema ?? STARTER_TEMPLATE, null, 2)
}

export default function StructuredDataEditor({
  initialSchema,
  pageSlug,
}: StructuredDataEditorProps) {
  const [value, setValue] = useState(() => formatEditorValue(initialSchema))
  const [saving, setSaving] = useState(false)
  const [validation, setValidation] = useState<{
    kind: "success" | "error"
    message: string
  } | null>(null)

  useEffect(() => {
    setValue(formatEditorValue(initialSchema))
    setValidation(null)
  }, [initialSchema, pageSlug])

  const validateJson = () => {
    try {
      JSON.parse(value)
      setValidation({ kind: "success", message: "JSON is valid." })
    } catch (error) {
      setValidation({
        kind: "error",
        message: error instanceof Error ? error.message : "Invalid JSON",
      })
    }
  }

  const saveSchema = async () => {
    setSaving(true)

    let parsed: unknown
    try {
      parsed = JSON.parse(value)
    } catch {
      toast.error("Invalid JSON")
      setSaving(false)
      return
    }

    try {
      const response = await fetch("/api/seo/structured-data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageSlug, schema: parsed }),
      })

      const data = (await response.json()) as StructuredDataResponse
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save structured data")
      }

      toast.success("Structured data saved.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save structured data"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rw-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Structured Data (JSON-LD)</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Add schema.org markup to improve search appearance. Must include @context and @type.
          </p>
        </div>
        <span className="rw-pill">
          Page: {pageSlug}
        </span>
      </div>

      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={14}
        spellCheck={false}
        className="rw-textarea mt-4 font-mono"
      />

      <div className="mt-2 flex items-center justify-between gap-4">
        <p className="text-xs text-[var(--text-secondary)]">{value.length} characters</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={validateJson}
            className="rw-btn rw-btn-secondary"
          >
            Validate JSON
          </button>
          <button
            type="button"
            onClick={() => void saveSchema()}
            disabled={saving}
            className="rw-btn rw-btn-primary"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {validation ? (
        <div
          className={`mt-3 rounded-md border px-3 py-2 text-sm ${
            validation.kind === "success"
              ? "border-[color:rgba(34,197,94,0.3)] bg-[var(--success-bg)] text-[var(--success)]"
              : "border-[color:rgba(239,68,68,0.3)] bg-[var(--error-bg)] text-[var(--error)]"
          }`}
        >
          {validation.message}
        </div>
      ) : null}
    </div>
  )
}
