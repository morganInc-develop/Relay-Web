"use client"

import { useEffect, useRef, useState } from "react"

/**
 * RELAY_DESIGN_PREVIEW postMessage protocol
 *
 * Sent by the dashboard to the embedded site iframe whenever design tokens change.
 * Client sites should implement the following listener:
 *
 *   window.addEventListener("message", (e) => {
 *     if (e.data?.type !== "RELAY_DESIGN_PREVIEW") return
 *     for (const [prop, val] of Object.entries(e.data.tokens)) {
 *       document.documentElement.style.setProperty(prop, String(val))
 *     }
 *   })
 *
 * Token shape: Record<string, string> — CSS custom property names with "--" prefix.
 * Example: { "--color-primary": "#6366f1", "--font-heading": "'Playfair Display', serif" }
 */

interface PreviewFrameProps {
  siteUrl: string | null
  cssVars: Record<string, string>
}

export default function PreviewFrame({ siteUrl, cssVars }: PreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "RELAY_DESIGN_PREVIEW", tokens: cssVars },
      "*"
    )
  }, [cssVars])

  if (!siteUrl) {
    return (
      <div className="sticky top-6 h-[calc(100vh-6rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex h-full items-center justify-center p-6 text-center">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Connect your domain to enable live preview
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Live preview becomes available once your site has a connected domain.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sticky top-6 flex h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <p className="truncate pr-4 text-xs text-slate-500">{siteUrl}</p>
        <button
          type="button"
          onClick={() => {
            setLoaded(false)
            iframeRef.current?.contentWindow?.location?.reload()
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-sm text-slate-600 transition hover:bg-slate-50"
          aria-label="Refresh preview"
        >
          ↺
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        {!loaded ? (
          <div className="absolute inset-x-0 top-0 z-10 border-b border-slate-100 bg-white/90 px-4 py-2 text-xs text-slate-500">
            Loading preview...
          </div>
        ) : null}

        <iframe
          ref={iframeRef}
          src={siteUrl}
          className="h-full w-full border-0"
          onLoad={() => setLoaded(true)}
          title="Live site preview"
        />
      </div>
    </div>
  )
}
