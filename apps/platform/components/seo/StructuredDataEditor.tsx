"use client"

import { useEffect, useState } from "react"

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
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null)

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
    setToast(null)

    let parsed: unknown
    try {
      parsed = JSON.parse(value)
    } catch {
      setToast({ kind: "error", message: "Invalid JSON" })
      setSaving(false)
      setTimeout(() => setToast(null), 3000)
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

      setToast({ kind: "success", message: "Structured data saved." })
    } catch (error) {
      setToast({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Failed to save structured data",
      })
    } finally {
      setSaving(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  return (
    <div className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Structured Data (JSON-LD)</h3>
          <p className="mt-1 text-sm text-slate-500">
            Add schema.org markup to improve search appearance. Must include @context and @type.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          Page: {pageSlug}
        </span>
      </div>

      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={14}
        spellCheck={false}
        className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-3 font-mono text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
      />

      <div className="mt-2 flex items-center justify-between gap-4">
        <p className="text-xs text-slate-500">{value.length} characters</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={validateJson}
            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Validate JSON
          </button>
          <button
            type="button"
            onClick={() => void saveSchema()}
            disabled={saving}
            className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {validation ? (
        <div
          className={`mt-3 rounded-md border px-3 py-2 text-sm ${
            validation.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {validation.message}
        </div>
      ) : null}

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
