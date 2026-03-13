"use client"

import { useState } from "react"
import { Search } from "lucide-react"

interface AuditCheck {
  score: number
  status: "pass" | "warning" | "fail"
  recommendation: string
}

interface AuditResults {
  overallScore: number
  checks: Record<string, AuditCheck>
  topRecommendation: string
}

interface RecentAudit {
  id: string
  pageSlug: string
  overallScore: number
  createdAt: Date
}

interface SEOAuditPanelProps {
  siteId: string
  maxKeywords: number
  recentAudits: RecentAudit[]
}

const checkLabels: Record<string, string> = {
  titleTag: "Title Tag",
  metaDescription: "Meta Description",
  headingStructure: "Heading Structure",
  keywordDensity: "Keyword Density",
  ogImage: "Open Graph Image",
}

const statusColors = {
  pass: "text-green-600 bg-green-50 border-green-200",
  warning: "text-amber-600 bg-amber-50 border-amber-200",
  fail: "text-red-600 bg-red-50 border-red-200",
}

export default function SEOAuditPanel({
  siteId,
  maxKeywords,
  recentAudits,
}: SEOAuditPanelProps) {
  const [pageSlug, setPageSlug] = useState("")
  const [keywords, setKeywords] = useState("")
  const [isAuditing, setIsAuditing] = useState(false)
  const [results, setResults] = useState<AuditResults | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runAudit() {
    if (!pageSlug || !keywords) return
    const keywordList = keywords.split(",").map((k) => k.trim()).filter(Boolean)
    if (keywordList.length > maxKeywords) {
      setError(`Your plan allows ${maxKeywords} keyword${maxKeywords === 1 ? "" : "s"} per audit`)
      return
    }

    setIsAuditing(true)
    setError(null)
    setResults(null)

    try {
      const res = await fetch("/api/seo/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, pageSlug, keywords: keywordList }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status !== 429) setError(data.error ?? "Audit failed")
        return
      }
      setResults(data.results)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed")
    } finally {
      setIsAuditing(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Audit form */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Run New Audit</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Page slug</label>
            <input
              type="text"
              value={pageSlug}
              onChange={(e) => setPageSlug(e.target.value)}
              placeholder="e.g. home, about, services"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target keywords
              <span className="text-gray-400 font-normal ml-2 text-xs">
                comma-separated, max {maxKeywords}
              </span>
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="e.g. web design, custom website, next.js agency"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            onClick={runAudit}
            disabled={isAuditing || !pageSlug || !keywords}
            className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            {isAuditing ? "Analyzing..." : "Run audit"}
          </button>
        </div>
      </div>

      {/* Audit results */}
      {results && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-gray-900">Audit Results</h2>
            <div className="flex items-center gap-2">
              <div
                className={`text-3xl font-bold ${
                  results.overallScore >= 80
                    ? "text-green-600"
                    : results.overallScore >= 50
                    ? "text-amber-600"
                    : "text-red-600"
                }`}
              >
                {results.overallScore}
              </div>
              <span className="text-gray-400 text-sm">/100</span>
            </div>
          </div>

          {results.topRecommendation && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-blue-800 text-sm font-medium">Top recommendation</p>
              <p className="text-blue-700 text-sm mt-1">{results.topRecommendation}</p>
            </div>
          )}

          <div className="space-y-3">
            {Object.entries(results.checks).map(([key, check]) => (
              <div
                key={key}
                className={`border rounded-lg p-4 ${statusColors[check.status]}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{checkLabels[key] ?? key}</span>
                  <span className="font-bold text-sm">{check.score}/100</span>
                </div>
                {check.recommendation && check.status !== "pass" && (
                  <p className="text-sm mt-1 opacity-80">{check.recommendation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent audits */}
      {recentAudits.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Recent Audits</h2>
          <div className="space-y-2">
            {recentAudits.map((audit) => (
              <div
                key={audit.id}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <span className="text-sm text-gray-700">/{audit.pageSlug}</span>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-semibold ${
                      audit.overallScore >= 80
                        ? "text-green-600"
                        : audit.overallScore >= 50
                        ? "text-amber-600"
                        : "text-red-600"
                    }`}
                  >
                    {audit.overallScore}/100
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(audit.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
