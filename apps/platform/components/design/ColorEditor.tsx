"use client"

import { useEffect, useMemo, useState } from "react"
import chroma from "chroma-js"
import { HexColorPicker } from "react-colorful"
import { toast } from "sonner"

interface ColorEditorProps {
  tokenKey: string
  label: string
  initialValue: string
  type: "solid" | "gradient"
  onLivePreview?: (key: string, value: string) => void
}

interface UpdateColorResponse {
  success?: boolean
  error?: string
}

function normalizeHex(value: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback
}

function extractGradientStops(value: string): { start: string; stop: string } {
  const matches = value.match(/#[0-9a-fA-F]{6}/g) ?? []
  const start = normalizeHex(matches[0] ?? "", "#6366f1")
  const stop = normalizeHex(matches[1] ?? "", "#8b5cf6")
  return { start, stop }
}

function normalizeGradientStops(start: string, stop: string): { start: string; stop: string } {
  const normalized = chroma.scale([start, stop]).mode("lab").colors(2)
  return {
    start: normalized[0],
    stop: normalized[1],
  }
}

export default function ColorEditor({
  tokenKey,
  label,
  initialValue,
  type,
  onLivePreview,
}: ColorEditorProps) {
  const initialSolid = normalizeHex(initialValue, "#6366f1")
  const initialGradient = extractGradientStops(initialValue)

  const [solidColor, setSolidColor] = useState(initialSolid)
  const [startColor, setStartColor] = useState(initialGradient.start)
  const [stopColor, setStopColor] = useState(initialGradient.stop)
  const [saving, setSaving] = useState(false)

  const gradientValue = useMemo(() => {
    try {
      const normalized = normalizeGradientStops(startColor, stopColor)
      return `linear-gradient(135deg, ${normalized.start}, ${normalized.stop})`
    } catch {
      return `linear-gradient(135deg, ${startColor}, ${stopColor})`
    }
  }, [startColor, stopColor])

  useEffect(() => {
    if (type === "gradient") {
      onLivePreview?.(tokenKey, gradientValue)
    }
    // onLivePreview is intentionally omitted to avoid parent callback identity churn retriggering the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradientValue, tokenKey, type])

  const saveToken = async () => {
    setSaving(true)

    try {
      const value = type === "solid" ? solidColor : gradientValue

      const response = await fetch("/api/design/update-color", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: tokenKey,
          value,
          type,
        }),
      })

      const data = (await response.json()) as UpdateColorResponse
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save token")
      }

      toast.success("Token updated and rebuild triggered.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save token")
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="rw-card p-5">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{label}</h3>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">{tokenKey}</p>

      {type === "solid" ? (
        <div className="mt-4 space-y-4">
          <HexColorPicker
            color={solidColor}
            onChange={(newColor) => {
              setSolidColor(newColor)
              onLivePreview?.(tokenKey, newColor)
            }}
          />
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-md border border-[var(--border-default)]"
              style={{ backgroundColor: solidColor }}
              aria-label={`${label} preview`}
            />
            <span className="font-mono text-xs text-[var(--text-secondary)]">{solidColor}</span>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          <div>
            <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Start</p>
            <HexColorPicker color={startColor} onChange={setStartColor} />
            <p className="mt-2 font-mono text-xs text-[var(--text-secondary)]">{startColor}</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Stop</p>
            <HexColorPicker color={stopColor} onChange={setStopColor} />
            <p className="mt-2 font-mono text-xs text-[var(--text-secondary)]">{stopColor}</p>
          </div>
          <div
            className="h-10 rounded-md border border-[var(--border-default)]"
            style={{ backgroundImage: gradientValue }}
            aria-label={`${label} preview`}
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => void saveToken()}
        disabled={saving}
        className="rw-btn rw-btn-primary mt-5"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </article>
  )
}
