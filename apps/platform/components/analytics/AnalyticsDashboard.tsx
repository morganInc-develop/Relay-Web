"use client"

import { useEffect, useMemo, useState } from "react"

type AnalyticsSummary = {
  pageViews: number
  uniqueVisitors: number
  topPages: Array<{ path: string; views: number }>
  topSources: Array<{ source: string; visitors: number }>
  devices: Array<{ device: string; percentage: number }>
  countries: Array<{ country: string; visitors: number }>
}

const EMPTY_SUMMARY: AnalyticsSummary = {
  pageViews: 0,
  uniqueVisitors: 0,
  topPages: [],
  topSources: [],
  devices: [],
  countries: [],
}

export default function AnalyticsDashboard() {
  const [summary, setSummary] = useState<AnalyticsSummary>(EMPTY_SUMMARY)
  const [loading, setLoading] = useState(true)

  const isEmpty = useMemo(() => {
    return (
      summary.pageViews === 0 &&
      summary.uniqueVisitors === 0 &&
      summary.topPages.length === 0 &&
      summary.topSources.length === 0 &&
      summary.devices.length === 0 &&
      summary.countries.length === 0
    )
  }, [summary])

  useEffect(() => {
    let cancelled = false

    const loadSummary = async () => {
      try {
        const res = await fetch("/api/analytics/summary", { cache: "no-store" })
        const data = (await res.json()) as AnalyticsSummary

        if (!cancelled && res.ok) {
          setSummary({
            pageViews: typeof data.pageViews === "number" ? data.pageViews : 0,
            uniqueVisitors: typeof data.uniqueVisitors === "number" ? data.uniqueVisitors : 0,
            topPages: Array.isArray(data.topPages) ? data.topPages : [],
            topSources: Array.isArray(data.topSources) ? data.topSources : [],
            devices: Array.isArray(data.devices) ? data.devices : [],
            countries: Array.isArray(data.countries) ? data.countries : [],
          })
        }
      } catch {
        if (!cancelled) {
          setSummary(EMPTY_SUMMARY)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSummary()

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Loading analytics...
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        No analytics data yet. Visit your site and check back once traffic is recorded.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">Page views</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.pageViews}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">Unique visitors</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.uniqueVisitors}</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">Top pages</h2>
        <ol className="mt-3 space-y-2 text-sm text-slate-700">
          {summary.topPages.map((page) => (
            <li key={page.path} className="flex items-center justify-between">
              <span>{page.path}</span>
              <span className="font-medium text-slate-900">{page.views}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">Traffic sources</h2>
        <ol className="mt-3 space-y-2 text-sm text-slate-700">
          {summary.topSources.map((source) => (
            <li key={source.source} className="flex items-center justify-between">
              <span>{source.source}</span>
              <span className="font-medium text-slate-900">{source.visitors}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Devices</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {summary.devices.map((device) => (
              <li key={device.device} className="flex items-center justify-between">
                <span className="capitalize">{device.device}</span>
                <span className="font-medium text-slate-900">{device.percentage}%</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Countries</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {summary.countries.map((country) => (
              <li key={country.country} className="flex items-center justify-between">
                <span>{country.country}</span>
                <span className="font-medium text-slate-900">{country.visitors}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
