"use client"

import { useState } from "react"

import ComponentCanvas from "@/components/dashboard/ComponentCanvas"
import type { CanvasItem } from "@/lib/canvas-registry"

interface CanvasPageSelectorProps {
  initialPageSlug: string
  initialLayout: CanvasItem[]
  initialPages: Array<{ slug: string; title: string }>
}

interface CanvasResponse {
  layout?: CanvasItem[]
}

export default function CanvasPageSelector({
  initialPageSlug,
  initialLayout,
  initialPages,
}: CanvasPageSelectorProps) {
  const [pageSlug, setPageSlug] = useState(initialPageSlug)
  const [layout, setLayout] = useState(initialLayout)
  const [pages] = useState(initialPages)
  const [loadingCanvas, setLoadingCanvas] = useState(false)

  const handlePageChange = async (newSlug: string) => {
    setLoadingCanvas(true)

    try {
      const response = await fetch(
        `/api/components/canvas?pageSlug=${encodeURIComponent(newSlug)}`
      )
      const data = (await response.json()) as CanvasResponse
      setPageSlug(newSlug)
      setLayout(Array.isArray(data.layout) ? data.layout : [])
    } catch {
      setPageSlug(newSlug)
      setLayout([])
    } finally {
      setLoadingCanvas(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Page</label>
        <select
          value={pageSlug}
          onChange={(event) => void handlePageChange(event.target.value)}
          disabled={loadingCanvas}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          {pages.map((page) => (
            <option key={page.slug} value={page.slug}>
              {page.title}
            </option>
          ))}
        </select>
        {loadingCanvas ? <span className="text-xs text-slate-400">Loading...</span> : null}
      </div>

      <ComponentCanvas key={pageSlug} pageSlug={pageSlug} initialLayout={layout} />
    </div>
  )
}
