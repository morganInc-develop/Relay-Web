"use client"

import { useEffect, useState } from "react"
import { Check, Clock3, RotateCcw, Save } from "lucide-react"
import ScheduledPublish from "@/components/content/ScheduledPublish"

type SeoFieldKey = "metaTitle" | "metaDescription" | "ogTitle" | "ogDescription" | "ogImage"

interface PageOption {
  id: string
  slug: string
  title: string
}

interface VersionItem {
  id: string
  oldValue: string
  newValue: string
  createdAt: string
}

type EditorState =
  | { status: "loading" }
  | { status: "idle"; pages: PageOption[] }
  | { status: "page-loading"; pages: PageOption[]; selectedSlug: string }
  | {
      status: "page-loaded"
      pages: PageOption[]
      selectedSlug: string
      fields: Record<string, string>
      versions: Record<string, VersionItem[]>
      saving: string | null
      saved: string | null
      versionsRemaining: Record<string, number>
      drawerOpen: string | null
    }
  | { status: "error"; message: string }

interface GetPageResponse {
  pageId?: string
  slug?: string
  error?: string
  [key: string]: unknown
}

interface ListPagesResponse {
  pages?: PageOption[]
  error?: string
}

interface SaveResponse {
  success?: boolean
  versionsRemaining?: number
  error?: string
}

interface RevertResponse {
  success?: boolean
  revertedTo?: string
  error?: string
}

const seoFields: Array<{ key: SeoFieldKey; label: string; max?: number; type: "text" | "textarea" | "url" }> = [
  { key: "metaTitle", label: "Meta Title", max: 60, type: "text" },
  { key: "metaDescription", label: "Meta Description", max: 160, type: "textarea" },
  { key: "ogTitle", label: "OG Title", max: 60, type: "text" },
  { key: "ogDescription", label: "OG Description", max: 200, type: "textarea" },
  { key: "ogImage", label: "OG Image", type: "url" },
]

function normalizeSeoFields(raw: Record<string, string>): Record<string, string> {
  return {
    metaTitle: raw.metaTitle ?? raw["meta.title"] ?? "",
    metaDescription: raw.metaDescription ?? raw["meta.description"] ?? "",
    ogTitle: raw.ogTitle ?? raw["openGraph.title"] ?? raw["meta.ogTitle"] ?? "",
    ogDescription:
      raw.ogDescription ?? raw["openGraph.description"] ?? raw["meta.ogDescription"] ?? "",
    ogImage: raw.ogImage ?? raw["openGraph.url"] ?? raw["meta.ogImage"] ?? "",
  }
}

function normalizeVersions(
  raw: Record<string, VersionItem[]>
): Record<string, Array<{ id: string; oldValue: string; newValue: string; createdAt: string }>> {
  const normalized: Record<string, VersionItem[]> = {}

  for (const field of seoFields) {
    normalized[field.key] = Array.isArray(raw[field.key]) ? raw[field.key] : []
  }

  return normalized
}

async function fetchPages(): Promise<PageOption[]> {
  const response = await fetch("/api/content/list-pages", { cache: "no-store" })
  const data = (await response.json()) as ListPagesResponse

  if (!response.ok) {
    throw new Error(data.error ?? "Failed to load pages")
  }

  return Array.isArray(data.pages) ? data.pages : []
}

async function fetchSeoPage(slug: string): Promise<{
  fields: Record<string, string>
  versions: Record<string, VersionItem[]>
}> {
  const response = await fetch(`/api/content/get-page?slug=${encodeURIComponent(slug)}`, {
    cache: "no-store",
  })
  const data = (await response.json()) as GetPageResponse

  if (!response.ok) {
    throw new Error(data.error ?? "Failed to load page")
  }

  const flatFields: Record<string, string> = {}
  for (const [key, value] of Object.entries(data)) {
    if (key === "pageId" || key === "slug" || key === "error") continue
    if (typeof value === "string") {
      flatFields[key] = value
    }
  }

  return {
    fields: normalizeSeoFields(flatFields),
    versions: normalizeVersions({}),
  }
}

export default function SeoEditor() {
  const [state, setState] = useState<EditorState>({ status: "loading" })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    let active = true

    async function loadPageOptions() {
      try {
        const pages = await fetchPages()
        if (!active) return
        setState({ status: "idle", pages })
      } catch (error) {
        if (!active) return
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Failed to load pages",
        })
      }
    }

    void loadPageOptions()

    return () => {
      active = false
    }
  }, [])

  const loadPage = async (pages: PageOption[], slug: string, versionsRemaining?: Record<string, number>) => {
    setState({ status: "page-loading", pages, selectedSlug: slug })

    try {
      const data = await fetchSeoPage(slug)
      setFieldErrors({})
      setState({
        status: "page-loaded",
        pages,
        selectedSlug: slug,
        fields: data.fields,
        versions: data.versions,
        saving: null,
        saved: null,
        versionsRemaining: versionsRemaining ?? {},
        drawerOpen: null,
      })
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to load page",
      })
    }
  }

  const updateField = (field: SeoFieldKey, value: string) => {
    setState((current) => {
      if (current.status !== "page-loaded") return current

      return {
        ...current,
        fields: {
          ...current.fields,
          [field]: value,
        },
      }
    })

    setFieldErrors((current) => ({ ...current, [field]: "" }))
  }

  const saveField = async (field: SeoFieldKey) => {
    if (state.status !== "page-loaded") return

    const snapshot = state
    const value = snapshot.fields[field] ?? ""

    setState({
      ...snapshot,
      saving: field,
      saved: null,
    })

    try {
      const response = await fetch("/api/content/update-seo", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page: snapshot.selectedSlug,
          field,
          value,
        }),
      })

      const result = (await response.json()) as SaveResponse
      if (!response.ok) {
        throw new Error(result.error ?? "Failed to save field")
      }

      const refreshed = await fetchSeoPage(snapshot.selectedSlug)
      const versionsRemaining = {
        ...snapshot.versionsRemaining,
        ...(typeof result.versionsRemaining === "number" ? { [field]: result.versionsRemaining } : {}),
      }

      setFieldErrors((current) => ({ ...current, [field]: "" }))
      setState({
        status: "page-loaded",
        pages: snapshot.pages,
        selectedSlug: snapshot.selectedSlug,
        fields: refreshed.fields,
        versions: refreshed.versions,
        saving: null,
        saved: field,
        versionsRemaining,
        drawerOpen: snapshot.drawerOpen,
      })

      setTimeout(() => {
        setState((current) => {
          if (current.status !== "page-loaded") return current
          if (current.saved !== field) return current
          return { ...current, saved: null }
        })
      }, 2000)
    } catch (error) {
      setFieldErrors((current) => ({
        ...current,
        [field]: error instanceof Error ? error.message : "Failed to save field",
      }))

      setState((current) => {
        if (current.status !== "page-loaded") return current
        return {
          ...current,
          saving: null,
          saved: null,
        }
      })
    }
  }

  const revertField = async (field: SeoFieldKey, versionId: string) => {
    if (state.status !== "page-loaded") return

    const snapshot = state

    setState({
      ...snapshot,
      saving: field,
    })

    try {
      const response = await fetch("/api/content/revert", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ versionId }),
      })

      const result = (await response.json()) as RevertResponse
      if (!response.ok) {
        throw new Error(result.error ?? "Failed to revert field")
      }

      const revertedTo = result.revertedTo ?? ""

      const refreshed = await fetchSeoPage(snapshot.selectedSlug)

      setFieldErrors((current) => ({ ...current, [field]: "" }))
      setState({
        status: "page-loaded",
        pages: snapshot.pages,
        selectedSlug: snapshot.selectedSlug,
        fields: {
          ...refreshed.fields,
          [field]: revertedTo,
        },
        versions: refreshed.versions,
        saving: null,
        saved: field,
        versionsRemaining: snapshot.versionsRemaining,
        drawerOpen: null,
      })

      setTimeout(() => {
        setState((current) => {
          if (current.status !== "page-loaded") return current
          if (current.saved !== field) return current
          return { ...current, saved: null }
        })
      }, 2000)
    } catch (error) {
      setFieldErrors((current) => ({
        ...current,
        [field]: error instanceof Error ? error.message : "Failed to revert field",
      }))

      setState((current) => {
        if (current.status !== "page-loaded") return current
        return {
          ...current,
          saving: null,
        }
      })
    }
  }

  if (state.status === "loading") {
    return <p className="text-sm text-gray-500">Loading SEO editor...</p>
  }

  if (state.status === "error") {
    return <p className="text-sm text-red-600">{state.message}</p>
  }

  const pages = state.pages

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="seo-page" className="block text-sm font-medium text-gray-700">
          Page
        </label>
        <select
          id="seo-page"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          value={state.status === "idle" ? "" : state.selectedSlug}
          onChange={(event) => {
            const slug = event.target.value
            if (!slug) return
            void loadPage(pages, slug, state.status === "page-loaded" ? state.versionsRemaining : {})
          }}
        >
          <option value="">Select a page</option>
          {pages.map((page) => (
            <option key={page.slug} value={page.slug}>
              {page.title}
            </option>
          ))}
        </select>
      </div>

      {state.status === "idle" && (
        <p className="text-sm text-gray-500">Select a page to edit SEO fields.</p>
      )}

      {state.status === "page-loading" && (
        <p className="text-sm text-gray-500">Loading SEO fields...</p>
      )}

      {state.status === "page-loaded" && (
        <div className="space-y-4">
          {seoFields.map((seoField) => {
            const value = state.fields[seoField.key] ?? ""
            const versions = state.versions[seoField.key] ?? []
            const overLimit = typeof seoField.max === "number" && value.length > seoField.max
            const saving = state.saving === seoField.key
            const saved = state.saved === seoField.key
            const drawerOpen = state.drawerOpen === seoField.key

            return (
              <div key={seoField.key} className="rounded-xl border border-gray-200 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-gray-800">{seoField.label}</label>

                  <div className="flex items-center gap-3">
                    {typeof seoField.max === "number" && (
                      <span className={`text-xs ${overLimit ? "font-semibold text-red-600" : "text-gray-500"}`}>
                        {value.length}/{seoField.max}
                      </span>
                    )}

                    {typeof state.versionsRemaining[seoField.key] === "number" && (
                      <span className="text-xs text-gray-500">
                        {state.versionsRemaining[seoField.key]} versions remaining
                      </span>
                    )}
                  </div>
                </div>

                {seoField.type === "textarea" && (
                  <textarea
                    value={value}
                    onChange={(event) => updateField(seoField.key, event.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                )}

                {seoField.type === "text" && (
                  <input
                    type="text"
                    value={value}
                    onChange={(event) => updateField(seoField.key, event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                )}

                {seoField.type === "url" && (
                  <input
                    type="url"
                    value={value}
                    onChange={(event) => updateField(seoField.key, event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                )}

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void saveField(seoField.key)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saving ? "Saving..." : "Save"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setState((current) => {
                        if (current.status !== "page-loaded") return current
                        return {
                          ...current,
                          drawerOpen: current.drawerOpen === seoField.key ? null : seoField.key,
                        }
                      })
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700"
                  >
                    <Clock3 className="h-3.5 w-3.5" />
                    History
                  </button>

                  {saved && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                      <Check className="h-3.5 w-3.5" />
                      Saved
                    </span>
                  )}
                </div>

                <ScheduledPublish
                  page={state.selectedSlug}
                  field={seoField.key}
                  value={value}
                />

                {fieldErrors[seoField.key] && (
                  <p className="mt-2 text-xs text-red-600">{fieldErrors[seoField.key]}</p>
                )}

                <div
                  className={`mt-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 transition-all ${
                    drawerOpen ? "max-h-96 p-3" : "max-h-0 border-transparent p-0"
                  }`}
                >
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-700">Version History</p>

                    {versions.length === 0 && <p className="text-xs text-gray-500">No versions yet.</p>}

                    {versions.map((version) => (
                      <div key={version.id} className="rounded-md border border-gray-200 bg-white p-2">
                        <p className="text-xs text-gray-500">{new Date(version.createdAt).toLocaleString()}</p>
                        <p className="mt-1 text-xs text-gray-700">
                          Old: <span className="font-medium">{version.oldValue}</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => void revertField(seoField.key, version.id)}
                          className="mt-2 inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Revert
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
