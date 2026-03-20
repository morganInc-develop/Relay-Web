"use client"

import { useState } from "react"
import { toast } from "sonner"

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

  const applyVariant = async () => {
    setSaving(true)

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

      toast.success("Component variant updated and rebuild triggered.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save component variant")
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="rw-card p-5">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{sectionLabel}</h3>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">component-variant:{sectionType}</p>

      <div className="mt-4 space-y-3">
        {variants.map((variant) => {
          const isSelected = selectedId === variant.id

          return (
            <label
              key={variant.id}
              className={`block cursor-pointer rounded-xl border p-4 transition ${
                isSelected
                  ? "border-[var(--border-accent)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-default)]"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name={`component-variant-${sectionType}`}
                  value={variant.id}
                  checked={isSelected}
                  onChange={() => setSelectedId(variant.id)}
                  className="mt-1 h-4 w-4 border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--accent-500)] focus:ring-[var(--accent-500)]"
                />

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{variant.displayName}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{variant.description}</p>
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
        className="rw-btn rw-btn-primary mt-5"
      >
        {saving ? "Saving..." : "Apply Variant"}
      </button>
    </article>
  )
}
