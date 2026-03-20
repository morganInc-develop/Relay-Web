"use client"

import "@fontsource/cormorant-garamond/400.css"
import "@fontsource/cormorant-garamond/700.css"
import "@fontsource/dm-sans/400.css"
import "@fontsource/dm-sans/700.css"
import "@fontsource/dm-serif-display/400.css"
import "@fontsource/fraunces/400.css"
import "@fontsource/fraunces/700.css"
import "@fontsource/inter/400.css"
import "@fontsource/inter/700.css"
import "@fontsource/josefin-sans/400.css"
import "@fontsource/josefin-sans/700.css"
import "@fontsource/lato/400.css"
import "@fontsource/lato/700.css"
import "@fontsource/libre-baskerville/400.css"
import "@fontsource/libre-baskerville/700.css"
import "@fontsource/manrope/400.css"
import "@fontsource/manrope/700.css"
import "@fontsource/nunito/400.css"
import "@fontsource/nunito/700.css"
import "@fontsource/outfit/400.css"
import "@fontsource/outfit/700.css"
import "@fontsource/playfair-display/400.css"
import "@fontsource/playfair-display/700.css"
import "@fontsource/poppins/400.css"
import "@fontsource/poppins/700.css"
import "@fontsource/source-serif-4/400.css"
import "@fontsource/source-serif-4/700.css"

import { useState } from "react"
import { toast } from "sonner"

import { FONT_PAIRS } from "@/lib/font-pairs"

interface FontEditorProps {
  initialPairId: string
  onLivePreview?: (key: string, value: string) => void
}

interface UpdateFontResponse {
  success?: boolean
  error?: string
}

const headingPreviewWeightByPackage: Record<string, 400 | 700> = {
  "@fontsource/dm-serif-display": 400,
}

function getHeadingPreviewWeight(headingPackage: string): 400 | 700 {
  return headingPreviewWeightByPackage[headingPackage] ?? 700
}

export default function FontEditor({ initialPairId, onLivePreview }: FontEditorProps) {
  const [selectedId, setSelectedId] = useState(initialPairId)
  const [saving, setSaving] = useState(false)

  const applyFontPair = async () => {
    setSaving(true)

    try {
      const response = await fetch("/api/design/update-font", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "font-pair",
          value: selectedId,
        }),
      })

      const data = (await response.json()) as UpdateFontResponse
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save font pair")
      }

      toast.success("Font pair updated and rebuild triggered.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save font pair")
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="rw-card p-5">
      <div className="space-y-3">
        {FONT_PAIRS.map((pair) => {
          const isSelected = selectedId === pair.id

          return (
            <label
              key={pair.id}
              className={`block cursor-pointer rounded-xl border p-4 transition ${
                isSelected
                  ? "border-[var(--border-accent)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-default)]"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="font-pair"
                  value={pair.id}
                  checked={isSelected}
                  onChange={() => {
                    setSelectedId(pair.id)
                    onLivePreview?.("font-pair", pair.id)
                  }}
                  className="mt-1 h-4 w-4 border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--accent-500)] focus:ring-[var(--accent-500)]"
                />

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{pair.displayName}</p>
                  <p
                    className="mt-3 text-[20px] leading-tight text-[var(--text-primary)]"
                    style={{
                      fontFamily: pair.headingFamily,
                      fontWeight: getHeadingPreviewWeight(pair.headingPackage),
                    }}
                  >
                    Designing for confident first impressions
                  </p>
                  <p
                    className="mt-2 text-sm leading-6 text-[var(--text-secondary)]"
                    style={{ fontFamily: pair.bodyFamily, fontWeight: 400 }}
                  >
                    The quick brown fox jumps over the lazy dog
                  </p>
                </div>
              </div>
            </label>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => void applyFontPair()}
        disabled={saving}
        className="rw-btn rw-btn-primary mt-5"
      >
        {saving ? "Saving..." : "Apply Font Pair"}
      </button>
    </article>
  )
}
