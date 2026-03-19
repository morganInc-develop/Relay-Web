import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type TopPage = { path: string; views: number }
type TopSource = { source: string; visitors: number }
type DeviceBreakdown = { device: string; percentage: number }
type CountryBreakdown = { country: string; visitors: number }

type AnalyticsSummary = {
  pageViews: number
  uniqueVisitors: number
  topPages: TopPage[]
  topSources: TopSource[]
  devices: DeviceBreakdown[]
  countries: CountryBreakdown[]
}

const EMPTY_SUMMARY: AnalyticsSummary = {
  pageViews: 0,
  uniqueVisitors: 0,
  topPages: [],
  topSources: [],
  devices: [],
  countries: [],
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function extractArray(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== "object") return []

  const payload = data as Record<string, unknown>
  if (Array.isArray(payload.data)) return payload.data as Record<string, unknown>[]
  if (Array.isArray(payload.results)) return payload.results as Record<string, unknown>[]

  return []
}

function normalizePathEntries(entries: Record<string, unknown>[]): TopPage[] {
  return entries
    .map((entry) => {
      const metrics = (entry.metrics ?? {}) as Record<string, unknown>
      const path = String(entry.path ?? entry.value ?? entry.key ?? "").trim()
      const views =
        toNumber(entry.views) ||
        toNumber(entry.pageViews) ||
        toNumber(metrics.views) ||
        toNumber(metrics.pageViews) ||
        toNumber(metrics.value)

      return { path, views }
    })
    .filter((entry) => entry.path.length > 0 && entry.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, 10)
}

function normalizeSourceEntries(entries: Record<string, unknown>[]): TopSource[] {
  return entries
    .map((entry) => {
      const metrics = (entry.metrics ?? {}) as Record<string, unknown>
      const source = String(entry.source ?? entry.referrer ?? entry.value ?? entry.key ?? "").trim()
      const visitors =
        toNumber(entry.visitors) ||
        toNumber(entry.uniqueVisitors) ||
        toNumber(metrics.visitors) ||
        toNumber(metrics.uniqueVisitors) ||
        toNumber(metrics.value)

      return { source, visitors }
    })
    .filter((entry) => entry.source.length > 0 && entry.visitors > 0)
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 10)
}

function normalizeCountryEntries(entries: Record<string, unknown>[]): CountryBreakdown[] {
  return entries
    .map((entry) => {
      const metrics = (entry.metrics ?? {}) as Record<string, unknown>
      const country = String(entry.country ?? entry.value ?? entry.key ?? "").trim()
      const visitors =
        toNumber(entry.visitors) ||
        toNumber(entry.uniqueVisitors) ||
        toNumber(metrics.visitors) ||
        toNumber(metrics.uniqueVisitors) ||
        toNumber(metrics.value)

      return { country, visitors }
    })
    .filter((entry) => entry.country.length > 0 && entry.visitors > 0)
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 5)
}

function normalizeDeviceEntries(entries: Record<string, unknown>[]): DeviceBreakdown[] {
  const raw = entries
    .map((entry) => {
      const metrics = (entry.metrics ?? {}) as Record<string, unknown>
      const device = String(entry.device ?? entry.value ?? entry.key ?? "").trim().toLowerCase()
      const visitors =
        toNumber(entry.visitors) ||
        toNumber(entry.uniqueVisitors) ||
        toNumber(metrics.visitors) ||
        toNumber(metrics.uniqueVisitors) ||
        toNumber(metrics.value)

      return { device, visitors }
    })
    .filter((entry) => entry.device.length > 0 && entry.visitors > 0)

  const total = raw.reduce((sum, entry) => sum + entry.visitors, 0)
  if (total === 0) return []

  return raw
    .map((entry) => ({
      device: entry.device,
      percentage: Number(((entry.visitors / total) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.percentage - a.percentage)
}

function buildParams(projectId: string, domain: string | null): URLSearchParams {
  const now = new Date()
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const params = new URLSearchParams({
    projectId,
    from: from.toISOString(),
    to: now.toISOString(),
  })

  if (domain) {
    params.set("domain", domain)
  }

  return params
}

async function fetchVercelAnalytics(
  token: string,
  projectId: string,
  domain: string | null
): Promise<AnalyticsSummary> {
  const params = buildParams(projectId, domain)

  const fetchJson = async (path: string, extraParams?: Record<string, string>) => {
    const requestParams = new URLSearchParams(params)
    for (const [key, value] of Object.entries(extraParams ?? {})) {
      requestParams.set(key, value)
    }

    const response = await fetch(`https://api.vercel.com/v1/web/analytics${path}?${requestParams.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`Vercel analytics request failed: ${response.status}`)
    }

    return (await response.json()) as Record<string, unknown>
  }

  try {
    const [summaryRaw, pagesRaw, sourcesRaw, devicesRaw, countriesRaw] = await Promise.all([
      fetchJson("/summary"),
      fetchJson("/breakdown", { groupBy: "path" }),
      fetchJson("/breakdown", { groupBy: "referrer" }),
      fetchJson("/breakdown", { groupBy: "device" }),
      fetchJson("/breakdown", { groupBy: "country" }),
    ])

    const summaryMetrics = (summaryRaw.metrics ?? summaryRaw) as Record<string, unknown>

    const pageViews =
      toNumber(summaryMetrics.pageViews) ||
      toNumber(summaryMetrics.views) ||
      toNumber(summaryRaw.pageViews) ||
      toNumber(summaryRaw.views)

    const uniqueVisitors =
      toNumber(summaryMetrics.uniqueVisitors) ||
      toNumber(summaryMetrics.visitors) ||
      toNumber(summaryRaw.uniqueVisitors) ||
      toNumber(summaryRaw.visitors)

    return {
      pageViews,
      uniqueVisitors,
      topPages: normalizePathEntries(extractArray(pagesRaw)),
      topSources: normalizeSourceEntries(extractArray(sourcesRaw)),
      devices: normalizeDeviceEntries(extractArray(devicesRaw)),
      countries: normalizeCountryEntries(extractArray(countriesRaw)),
    }
  } catch (error) {
    Sentry.captureException(error)
    return EMPTY_SUMMARY
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { domain: true },
  })

  const vercelToken = process.env.VERCEL_API_TOKEN
  const vercelProjectId = process.env.VERCEL_PROJECT_ID

  if (!vercelToken || !vercelProjectId) {
    return NextResponse.json(EMPTY_SUMMARY)
  }

  const summary = await fetchVercelAnalytics(vercelToken, vercelProjectId, site?.domain ?? null)
  return NextResponse.json(summary)
}
