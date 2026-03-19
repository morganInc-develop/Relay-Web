"use client"

import { useEffect, useState } from "react"
import ScheduledPublish from "@/components/content/ScheduledPublish"

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
      fieldErrors: Record<string, string>
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

interface SaveFieldResponse {
  success?: boolean
  versionsRemaining?: number
  error?: string
}

interface GetVersionsResponse {
  versions?: Record<string, VersionItem[]>
  error?: string
}

async function fetchPages(): Promise<PageOption[]> {
  const response = await fetch("/api/content/list-pages", { cache: "no-store" })
  const data = (await response.json()) as ListPagesResponse

  if (!response.ok) {
    throw new Error(data.error ?? "Failed to load pages")
  }

  return Array.isArray(data.pages) ? data.pages : []
}

async function fetchPageData(slug: string): Promise<{ fields: Record<string, string>; versions: Record<string, VersionItem[]> }> {
  const [pageResponse, versionsResponse] = await Promise.all([
    fetch(`/api/content/get-page?slug=${encodeURIComponent(slug)}`, {
      cache: "no-store",
    }),
    fetch(`/api/content/versions?page=${encodeURIComponent(slug)}`, {
      cache: "no-store",
    }),
  ])

  const data = (await pageResponse.json()) as GetPageResponse
  const versionsData = (await versionsResponse.json()) as GetVersionsResponse

  if (!pageResponse.ok) {
    throw new Error(data.error ?? "Failed to load page")
  }

  if (!versionsResponse.ok) {
    throw new Error(versionsData.error ?? "Failed to load versions")
  }

  const fields: Record<string, string> = {}
  for (const [key, value] of Object.entries(data)) {
    if (key === "pageId" || key === "slug" || key === "error") continue
    if (typeof value === "string") {
      fields[key] = value
    }
  }

  return {
    fields,
    versions: versionsData.versions ?? {},
  }
}

export default function TextEditor() {
  const [state, setState] = useState<EditorState>({ status: "loading" })

  useEffect(() => {
    let active = true

    async function loadInitialPages() {
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

    void loadInitialPages()

    return () => {
      active = false
    }
  }, [])

  const loadPage = async (pages: PageOption[], slug: string, fieldErrors?: Record<string, string>) => {
    setState({ status: "page-loading", pages, selectedSlug: slug })

    try {
      const data = await fetchPageData(slug)
      setState({
        status: "page-loaded",
        pages,
        selectedSlug: slug,
        fields: data.fields,
        versions: data.versions,
        saving: null,
        saved: null,
        versionsRemaining: {},
        fieldErrors: fieldErrors ?? {},
      })
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to load page",
      })
    }
  }

  const updateFieldValue = (field: string, value: string) => {
    setState((current) => {
      if (current.status !== "page-loaded") return current

      return {
        ...current,
        fields: {
          ...current.fields,
          [field]: value,
        },
        fieldErrors: {
          ...current.fieldErrors,
          [field]: "",
        },
      }
    })
  }

  const saveField = async (field: string) => {
    if (state.status !== "page-loaded") return

    const snapshot = state
    const value = snapshot.fields[field] ?? ""

    setState({
      ...snapshot,
      saving: field,
      saved: null,
      fieldErrors: {
        ...snapshot.fieldErrors,
        [field]: "",
      },
    })

    try {
      const response = await fetch("/api/content/update-text", {
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

      const result = (await response.json()) as SaveFieldResponse
      if (!response.ok) {
        throw new Error(result.error ?? "Failed to save field")
      }

      const refreshed = await fetchPageData(snapshot.selectedSlug)

      setState({
        status: "page-loaded",
        pages: snapshot.pages,
        selectedSlug: snapshot.selectedSlug,
        fields: refreshed.fields,
        versions: refreshed.versions,
        saving: null,
        saved: field,
        versionsRemaining: {
          ...snapshot.versionsRemaining,
          ...(typeof result.versionsRemaining === "number"
            ? { [field]: result.versionsRemaining }
            : {}),
        },
        fieldErrors: {
          ...snapshot.fieldErrors,
          [field]: "",
        },
      })

      setTimeout(() => {
        setState((current) => {
          if (current.status !== "page-loaded") return current
          if (current.saved !== field) return current
          return { ...current, saved: null }
        })
      }, 2000)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save field"

      try {
        const refreshed = await fetchPageData(snapshot.selectedSlug)
        setState({
          status: "page-loaded",
          pages: snapshot.pages,
          selectedSlug: snapshot.selectedSlug,
          fields: refreshed.fields,
          versions: refreshed.versions,
          saving: null,
          saved: null,
          versionsRemaining: snapshot.versionsRemaining,
          fieldErrors: {
            ...snapshot.fieldErrors,
            [field]: message,
          },
        })
      } catch {
        setState({ status: "error", message })
      }
    }
  }

  if (state.status === "loading") {
    return <p className="text-sm text-gray-500">Loading editor...</p>
  }

  if (state.status === "error") {
    return <p className="text-sm text-red-600">{state.message}</p>
  }

  const pages = state.pages

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="content-page" className="block text-sm font-medium text-gray-700">
          Page
        </label>
        <select
          id="content-page"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          value={state.status === "idle" ? "" : state.selectedSlug}
          onChange={(event) => {
            const slug = event.target.value
            if (!slug) return
            void loadPage(pages, slug)
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
        <p className="text-sm text-gray-500">Select a page to start editing text fields.</p>
      )}

      {state.status === "page-loading" && (
        <p className="text-sm text-gray-500">Loading page fields...</p>
      )}

      {state.status === "page-loaded" && (
        <div className="space-y-4">
          {Object.entries(state.fields).map(([field, value]) => {
            const isSaving = state.saving === field
            const isSaved = state.saved === field
            const versions = state.versions[field] ?? []
            const error = state.fieldErrors[field]

            return (
              <div key={field} className="rounded-xl border border-gray-200 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-gray-800">{field}</label>
                  {typeof state.versionsRemaining[field] === "number" && (
                    <span className="text-xs text-gray-500">
                      {state.versionsRemaining[field]} versions remaining
                    </span>
                  )}
                </div>

                <textarea
                  className="min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={value}
                  onChange={(event) => updateFieldValue(field, event.target.value)}
                />

                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void saveField(field)}
                    disabled={isSaving}
                    className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>

                  {isSaved && <span className="text-xs font-medium text-green-600">Saved ✓</span>}
                </div>

                <ScheduledPublish page={state.selectedSlug} field={field} value={value} />

                {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

                <details className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3">
                  <summary className="cursor-pointer text-xs font-medium text-gray-700">
                    Version history ({versions.length})
                  </summary>

                  <div className="mt-2 space-y-2">
                    {versions.length === 0 && <p className="text-xs text-gray-500">No versions yet.</p>}

                    {versions.map((version) => (
                      <div key={version.id} className="rounded-md border border-gray-200 bg-white p-2">
                        <p className="text-xs text-gray-500">
                          {new Date(version.createdAt).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-700">
                          From: <span className="font-medium">{version.oldValue}</span>
                        </p>
                        <p className="text-xs text-gray-700">
                          To: <span className="font-medium">{version.newValue}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
