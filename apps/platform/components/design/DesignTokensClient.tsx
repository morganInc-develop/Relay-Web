"use client"

import { useState } from "react"

import ColorEditor from "@/components/design/ColorEditor"
import FontEditor from "@/components/design/FontEditor"
import PreviewFrame from "@/components/design/PreviewFrame"
import { getFontPairById } from "@/lib/font-pairs"

interface DesignTokensClientProps {
  tokenMap: Record<string, string>
  siteUrl: string | null
  tokenDefinitions: Array<{
    key: string
    label: string
    type: "solid" | "gradient"
    defaultValue: string
  }>
  defaultFontPairId: string
}

function buildCssVars(tokens: Record<string, string>): Record<string, string> {
  const css: Record<string, string> = {}

  for (const [key, value] of Object.entries(tokens)) {
    if (key === "font-pair") {
      const pair = getFontPairById(value)
      if (pair) {
        css["--font-heading"] = pair.headingFamily
        css["--font-body"] = pair.bodyFamily
      }
    } else {
      css[`--${key}`] = value
    }
  }

  return css
}

export default function DesignTokensClient({
  tokenMap,
  siteUrl,
  tokenDefinitions,
  defaultFontPairId,
}: DesignTokensClientProps) {
  const [liveTokens, setLiveTokens] = useState<Record<string, string>>(tokenMap)

  const handleLivePreview = (key: string, value: string) => {
    setLiveTokens((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <div className="flex-1 space-y-10">
        <section>
          <h2 className="text-xl font-bold text-slate-900">Colors</h2>
          <p className="mt-2 text-sm text-slate-500">
            Update your brand colors and gradients. Saving triggers a site rebuild.
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {tokenDefinitions.map((token) => (
              <ColorEditor
                key={token.key}
                tokenKey={token.key}
                label={token.label}
                initialValue={tokenMap[token.key] ?? token.defaultValue}
                type={token.type}
                onLivePreview={handleLivePreview}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900">Typography</h2>
          <p className="mt-2 text-sm text-slate-500">
            Choose a pre-paired font combination. Saving triggers a site rebuild.
          </p>
          <div className="mt-6">
            <FontEditor
              initialPairId={tokenMap["font-pair"] ?? defaultFontPairId}
              onLivePreview={handleLivePreview}
            />
          </div>
        </section>
      </div>

      <div className="w-full lg:w-[420px] lg:shrink-0">
        <PreviewFrame siteUrl={siteUrl} cssVars={buildCssVars(liveTokens)} />
      </div>
    </div>
  )
}
