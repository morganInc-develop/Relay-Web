"use client"

import { useEffect, useMemo, useState } from "react"

interface PageOption {
  slug: string
  title: string
}

interface AuditResult {
  scores: {
    metaTitle: number
    metaDescription: number
    keywords: number
    og: number
  }
  recommendations: string[]
  overallScore: number
  scansRemaining?: number | null
}

interface SeoAuditProps {
  maxKeywords: number
  canAutoFix: boolean
}

const scoreCards: Array<{ key: keyof AuditResult["scores"]; label: string }> = [
  { key: "metaTitle", label: "Meta Title" },
  { key: "metaDescription", label: "Meta Description" },
  { key: "keywords", label: "Keywords" },
  { key: "og", label: "Open Graph" },
]

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-700 bg-green-50 border-green-200"
  if (score >= 40) return "text-amber-700 bg-amber-50 border-amber-200"
  return "text-red-700 bg-red-50 border-red-200"
}

export default function SeoAudit({ maxKeywords, canAutoFix }: SeoAuditProps) {
  const [pages, setPages] = useState<PageOption[]>([])
  const [selectedPage, setSelectedPage] = useState("")
  const [keywordInput, setKeywordInput] = useState("")
  const [keywords, setKeywords] = useState<string[]>([])
  const [isLoadingPages, setIsLoadingPages] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [isFixing, setIsFixing] = useState(false)
  const [result, setResult] = useState<AuditResult | null>(null)
  const [fixedFields, setFixedFields] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadPages = async () => {
      setIsLoadingPages(true)
      setError(null)
      try {
        const res = await fetch("/api/content/list-pages")
        const data = (await res.json()) as PageOption[] | { error?: string }

        if (!res.ok) {
          const message = (data as { error?: string }).error ?? "Failed to load pages"
          throw new Error(message)
        }

        const pageList = Array.isArray(data) ? data : []
        setPages(pageList)
        if (pageList.length > 0) {
          setSelectedPage(pageList[0].slug)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load pages")
      } finally {
        setIsLoadingPages(false)
      }
    }

    void loadPages()
  }, [])

  const keywordCountLabel = useMemo(() => `${keywords.length}/${maxKeywords}`, [keywords.length, maxKeywords])

  const addKeyword = (raw: string) => {
    const next = raw.trim()
    if (!next) return
    if (keywords.includes(next)) return
    if (keywords.length >= maxKeywords) {
      setError(`Your plan allows ${maxKeywords} keyword${maxKeywords === 1 ? "" : "s"} per audit.`)
      return
    }

    setKeywords((prev) => [...prev, next])
    setKeywordInput("")
    setError(null)
  }

  const runAudit = async () => {
    if (!selectedPage || keywords.length === 0) return

    setIsScanning(true)
    setError(null)
    setResult(null)
    setFixedFields([])

    try {
      const res = await fetch("/api/seo/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: selectedPage, keywords }),
      })

      const data = (await res.json()) as AuditResult & { error?: string }
      if (!res.ok) {
        throw new Error(data.error ?? "Audit failed")
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed")
    } finally {
      setIsScanning(false)
    }
  }

  const runAutoFix = async () => {
    if (!result || !canAutoFix || !selectedPage) return

    setIsFixing(true)
    setError(null)
    try {
      const res = await fetch("/api/seo/auto-fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: selectedPage,
          recommendations: result.recommendations,
        }),
      })

      const data = (await res.json()) as { fixed?: string[]; error?: string }
      if (!res.ok) {
        throw new Error(data.error ?? "Auto-fix failed")
      }

      setFixedFields(Array.isArray(data.fixed) ? data.fixed : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auto-fix failed")
    } finally {
      setIsFixing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="border border-gray-200 rounded-xl p-4 space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Page</label>
          <select
            value={selectedPage}
            onChange={(e) => setSelectedPage(e.target.value)}
            disabled={isLoadingPages || pages.length === 0}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100"
          >
            {pages.map((page) => (
              <option key={page.slug} value={page.slug}>
                {page.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Keywords</label>
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-gray-50 px-2.5 py-1 text-xs"
              >
                {keyword}
                <button
                  type="button"
                  className="text-gray-500 hover:text-gray-700"
                  onClick={() => setKeywords((prev) => prev.filter((item) => item !== keyword))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault()
                addKeyword(keywordInput)
              }
            }}
            placeholder="Type a keyword and press Enter"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-500">Keyword limit: {keywordCountLabel}</p>
        </div>

        <button
          onClick={runAudit}
          disabled={isScanning || isLoadingPages || !selectedPage || keywords.length === 0}
          className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {isScanning ? "Analysing your SEO..." : "Run Audit"}
        </button>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {result && (
        <div className="border border-gray-200 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Audit Results</h3>
            <p className="text-sm text-gray-600">Overall: {result.overallScore}/100</p>
          </div>

          {typeof result.scansRemaining === "number" && (
            <p className="text-xs text-gray-500">Scans remaining this month: {result.scansRemaining}</p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {scoreCards.map((card) => (
              <div
                key={card.key}
                className={`border rounded-lg p-3 ${scoreColor(result.scores[card.key])}`}
              >
                <p className="text-xs font-medium">{card.label}</p>
                <p className="text-lg font-semibold mt-1">{result.scores[card.key]}/100</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-900">Recommendations</h4>
            {result.recommendations.length === 0 ? (
              <p className="text-sm text-gray-500">No recommendations returned.</p>
            ) : (
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                {result.recommendations.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            )}
          </div>

          {canAutoFix && (
            <button
              onClick={runAutoFix}
              disabled={isFixing || result.recommendations.length === 0}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {isFixing ? "Applying fixes..." : "Auto-Fix"}
            </button>
          )}

          {fixedFields.length > 0 && (
            <p className="text-sm text-green-700">Fixed fields: {fixedFields.join(", ")}</p>
          )}
        </div>
      )}
    </div>
  )
}
