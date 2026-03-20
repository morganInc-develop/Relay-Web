"use client"

import { useState } from "react"

import { getVariantsForSection } from "@/lib/component-variants"

interface ComponentSwapperProps {
  sectionType: string
  sectionLabel: string
  initialVariantId: string
}

interface UpdateComponentVariantResponse {
  success?: boolean
  error?: string
}

export default function ComponentSwapper({
  sectionType,
  sectionLabel,
  initialVariantId,
}: ComponentSwapperProps) {
  const variants = getVariantsForSection(sectionType)
  const [selectedId, setSelectedId] = useState(initialVariantId)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null)

  const applyVariant = async () => {
    setSaving(true)
    setToast(null)

    try {
      const response = await fetch("/api/layout/swap-component", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "component-variant:" + sectionType,
          value: selectedId,
        }),
      })

      const data = (await response.json()) as UpdateComponentVariantResponse
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save component variant")
      }

      setToast({ kind: "success", message: "Component variant updated and rebuild triggered." })
    } catch (error) {
      setToast({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to save component variant",
      })
    } finally {
      setSaving(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  return (
    <article className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{sectionLabel}</h3>
      <p className="mt-1 text-xs text-slate-500">component-variant:{sectionType}</p>

      <div className="mt-4 space-y-3">
        {variants.map((variant) => {
          const isSelected = selectedId === variant.id

          return (
            <label
              key={variant.id}
              className={`block cursor-pointer rounded-xl border p-4 transition ${
                isSelected
                  ? "border-slate-900 bg-slate-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name={`component-variant-${sectionType}`}
                  value={variant.id}
                  checked={isSelected}
                  onChange={() => setSelectedId(variant.id)}
                  className="mt-1 h-4 w-4 border-slate-300 text-slate-900 focus:ring-slate-900"
                />

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{variant.displayName}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{variant.description}</p>
                </div>
              </div>
            </label>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => void applyVariant()}
        disabled={saving}
        className="mt-5 inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving..." : "Apply Variant"}
      </button>

      {toast ? (
        <div
          className={`absolute right-4 top-4 rounded-md px-3 py-2 text-xs font-medium shadow-sm ${
            toast.kind === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      ) : null}
    </article>
  )
}
