"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

type Tier = "TIER1" | "TIER2" | "TIER3"

interface SeoAuditProps {
  tier: Tier
}

interface PageOption {
  slug: string
  title: string
}

interface AuditScores {
  metaTitle: number
  metaDescription: number
  keywords: number
  og: number
}

type AuditState =
  | { status: "idle" }
  | { status: "scanning" }
  | {
      status: "results"
      scores: AuditScores
      recommendations: string[]
      overallScore: number
      scansRemaining: number | null
      page: string
      keywords: string[]
    }
  | { status: "fixing" }
  | { status: "fixed"; fixedFields: string[] }
  | { status: "error"; message: string }

interface AuditResponse {
  scores: AuditScores
  recommendations: string[]
  overallScore: number
  scansRemaining: number | null
  error?: string
}

interface AutoFixResponse {
  fixed?: string[]
  skipped?: string[]
  error?: string
}

interface GetPageResponse {
  fields?: Record<string, string>
  error?: string
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-700 bg-green-50 border-green-200"
  if (score >= 40) return "text-amber-700 bg-amber-50 border-amber-200"
  return "text-red-700 bg-red-50 border-red-200"
}

function keywordLimitForTier(tier: Tier): number {
  if (tier === "TIER3") return 999
  if (tier === "TIER2") return 10
  return 3
}

function toCurrentFields(raw: Record<string, string>) {
  return {
    metaTitle: raw.metaTitle ?? raw["meta.title"] ?? "",
    metaDescription: raw.metaDescription ?? raw["meta.description"] ?? "",
    ogTitle: raw.ogTitle ?? raw["openGraph.title"] ?? raw["meta.ogTitle"] ?? "",
    ogDescription: raw.ogDescription ?? raw["openGraph.description"] ?? raw["meta.ogDescription"] ?? "",
    ogImage: raw.ogImage ?? raw["openGraph.url"] ?? raw["meta.ogImage"] ?? "",
  }
}

export default function SeoAudit({ tier }: SeoAuditProps) {
  const [state, setState] = useState<AuditState>({ status: "idle" })
  const [pages, setPages] = useState<PageOption[]>([])
  const [selectedPage, setSelectedPage] = useState("")
  const [keywordInput, setKeywordInput] = useState("")
  const [keywords, setKeywords] = useState<string[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [keywordWarning, setKeywordWarning] = useState<string | null>(null)

  const keywordLimit = useMemo(() => keywordLimitForTier(tier), [tier])
  const canAutoFix = tier === "TIER2" || tier === "TIER3"

  useEffect(() => {
    let active = true

    async function loadPages() {
      setPageLoading(true)
      try {
        const response = await fetch("/api/content/list-pages", { cache: "no-store" })
        const data = (await response.json()) as { pages?: PageOption[]; error?: string }

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load pages")
        }

        if (!active) return

        const pageList = Array.isArray(data.pages) ? data.pages : []
        setPages(pageList)
        setSelectedPage(pageList[0]?.slug ?? "")
      } catch (error) {
        if (!active) return
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Failed to load pages",
        })
      } finally {
        if (active) setPageLoading(false)
      }
    }

    void loadPages()

    return () => {
      active = false
    }
  }, [])

  const addKeyword = (raw: string) => {
    const keyword = raw.trim()
    if (!keyword) return
    if (keywords.includes(keyword)) return

    if (keywords.length >= keywordLimit) {
      setKeywordWarning(`Your plan supports up to ${keywordLimit} keywords.`)
      return
    }

    setKeywordWarning(null)
    setKeywords((current) => [...current, keyword])
    setKeywordInput("")
  }

  const removeKeyword = (keyword: string) => {
    setKeywords((current) => current.filter((item) => item !== keyword))
    setKeywordWarning(null)
  }

  const runAudit = async () => {
    if (!selectedPage) {
      setState({ status: "error", message: "Select a page before running an audit." })
      return
    }

    if (keywords.length === 0) {
      setState({ status: "error", message: "Add at least one keyword before running an audit." })
      return
    }

    if (keywords.length > keywordLimit) {
      setState({
        status: "error",
        message: `Your plan supports up to ${keywordLimit} keywords per audit.`,
      })
      return
    }

    setState({ status: "scanning" })
    const toastId = toast.loading("Running SEO audit...")

    try {
      const response = await fetch("/api/seo/audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page: selectedPage,
          keywords,
        }),
      })

      const data = (await response.json()) as AuditResponse

      if (!response.ok) {
        throw new Error(data.error ?? "Audit failed")
      }

      setState({
        status: "results",
        scores: data.scores,
        recommendations: data.recommendations,
        overallScore: data.overallScore,
        scansRemaining: data.scansRemaining,
        page: selectedPage,
        keywords: [...keywords],
      })
      toast.success("SEO audit complete.", { id: toastId })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Audit failed"
      setState({
        status: "error",
        message,
      })
      toast.error(message, { id: toastId })
    }
  }

  const runAutoFix = async () => {
    if (state.status !== "results") return
    if (!canAutoFix) return

    setState({ status: "fixing" })
    const toastId = toast.loading("Applying SEO auto-fix...")

    try {
      const pageResponse = await fetch(`/api/content/get-page?slug=${encodeURIComponent(state.page)}`, {
        cache: "no-store",
      })
      const pageData = (await pageResponse.json()) as GetPageResponse
      if (!pageResponse.ok) {
        throw new Error(pageData.error ?? "Failed to fetch page fields")
      }

      const currentFields = toCurrentFields(pageData.fields ?? {})

      const response = await fetch("/api/seo/auto-fix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page: state.page,
          recommendations: state.recommendations,
          currentFields,
        }),
      })

      const data = (await response.json()) as AutoFixResponse

      if (!response.ok) {
        throw new Error(data.error ?? "Auto-fix failed")
      }

      setState({ status: "fixed", fixedFields: data.fixed ?? [] })
      toast.success("SEO auto-fix complete.", { id: toastId })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Auto-fix failed"
      setState({
        status: "error",
        message,
      })
      toast.error(message, { id: toastId })
    }
  }

  return (
    <div className="space-y-6">
      <div className="rw-card p-4 space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-[var(--text-secondary)]">Page</label>
          <select
            value={selectedPage}
            disabled={pageLoading || pages.length === 0 || state.status === "scanning" || state.status === "fixing"}
            onChange={(event) => setSelectedPage(event.target.value)}
            className="rw-select"
          >
            {pages.map((page) => (
              <option key={page.slug} value={page.slug}>
                {page.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--text-secondary)]">Keywords</label>

          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword) => (
              <span
                key={keyword}
                className="rw-pill"
              >
                {keyword}
                <button type="button" onClick={() => removeKeyword(keyword)}>
                  ×
                </button>
              </span>
            ))}
          </div>

          <input
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault()
                addKeyword(keywordInput)
              }
            }}
            placeholder="Type a keyword and press Enter"
            className="rw-input"
          />

          <p className="text-xs text-[var(--text-secondary)]">
            Keywords: {keywords.length}/{keywordLimit}
          </p>
          {keywordWarning && <p className="text-xs text-[var(--warning)]">{keywordWarning}</p>}
        </div>

        <button
          type="button"
          onClick={() => void runAudit()}
          disabled={state.status === "scanning" || state.status === "fixing" || pageLoading}
          className="rw-btn rw-btn-primary"
        >
          {state.status === "scanning" ? "Scanning..." : "Run Audit"}
        </button>
      </div>

      {state.status === "results" && (
        <div className="rw-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Audit Results</h3>
            {state.scansRemaining !== null && (
              <span className="text-xs text-[var(--text-secondary)]">Scans remaining: {state.scansRemaining}</span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className={`rounded-lg border p-3 ${scoreColor(state.scores.metaTitle)}`}>
              <p className="text-xs font-medium">Meta Title</p>
              <p className="text-lg font-semibold">{state.scores.metaTitle}</p>
            </div>
            <div className={`rounded-lg border p-3 ${scoreColor(state.scores.metaDescription)}`}>
              <p className="text-xs font-medium">Meta Description</p>
              <p className="text-lg font-semibold">{state.scores.metaDescription}</p>
            </div>
            <div className={`rounded-lg border p-3 ${scoreColor(state.scores.keywords)}`}>
              <p className="text-xs font-medium">Keywords</p>
              <p className="text-lg font-semibold">{state.scores.keywords}</p>
            </div>
            <div className={`rounded-lg border p-3 ${scoreColor(state.scores.og)}`}>
              <p className="text-xs font-medium">Open Graph</p>
              <p className="text-lg font-semibold">{state.scores.og}</p>
            </div>
          </div>

          <div className={`rounded-lg border p-4 ${scoreColor(state.overallScore)}`}>
            <p className="text-xs font-medium">Overall Score</p>
            <p className="text-3xl font-bold">{state.overallScore}</p>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-[var(--text-primary)]">Recommendations</h4>
            <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
              {state.recommendations.map((recommendation, index) => (
                <li key={`${recommendation}-${index}`}>{recommendation}</li>
              ))}
            </ul>
          </div>

          {canAutoFix && (
            <button
              type="button"
              onClick={() => void runAutoFix()}
              className="rw-btn rw-btn-primary"
            >
              Auto-Fix
            </button>
          )}
        </div>
      )}

      {state.status === "fixing" && (
        <div className="rw-card p-4">
          <p className="text-sm text-[var(--text-secondary)]">Fixing...</p>
        </div>
      )}

      {state.status === "fixed" && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-700">Auto-fix complete.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-green-800">
            {state.fixedFields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </div>
      )}

      {state.status === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
          <p className="text-sm text-red-700">{state.message}</p>
          <button
            type="button"
            onClick={() => setState({ status: "idle" })}
            className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
