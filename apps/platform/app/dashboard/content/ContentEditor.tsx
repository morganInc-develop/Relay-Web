"use client"

import ScheduledPublish from "@/components/content/ScheduledPublish"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  RiCheckboxCircleLine,
  RiHistoryLine,
  RiRefreshLine,
  RiSaveLine,
} from "react-icons/ri"

interface ContentEditorProps {
  siteId: string
}

interface PageOption {
  id: string
  slug: string
  title: string
}

interface FieldVersion {
  id: string
  oldValue: string
  newValue: string
  createdAt: string
}

interface GetPageResponse {
  pageId?: string
  slug?: string
  error?: string
  [key: string]: unknown
}

interface VersionsResponse {
  versions?: Record<string, FieldVersion[]>
  error?: string
}

interface SignedUrlResponse {
  url?: string
}

type SeoApiField = "metaTitle" | "metaDescription" | "ogTitle" | "ogDescription" | "ogImage"

interface SeoFieldConfig {
  key: string
  apiField: SeoApiField
  label: string
  max?: number
  multiline: boolean
}

const seoFieldMap: SeoFieldConfig[] = [
  { key: "meta.title", apiField: "metaTitle", label: "Meta Title", max: 60, multiline: false },
  {
    key: "meta.description",
    apiField: "metaDescription",
    label: "Meta Description",
    max: 160,
    multiline: true,
  },
  { key: "meta.ogTitle", apiField: "ogTitle", label: "OG Title", max: 60, multiline: false },
  {
    key: "meta.ogDescription",
    apiField: "ogDescription",
    label: "OG Description",
    max: 200,
    multiline: true,
  },
  { key: "meta.ogImage", apiField: "ogImage", label: "OG Image URL", multiline: false },
]

type EditorTab = "text" | "seo"

function isImageField(fieldKey: string): boolean {
  return /image/i.test(fieldKey)
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function isR2Key(value: string): boolean {
  if (isHttpUrl(value)) return false
  if (value.includes(" ")) return false
  return value.includes("/")
}

export default function ContentEditor({ siteId }: ContentEditorProps) {
  const [pages, setPages] = useState<PageOption[]>([])
  const [selectedPage, setSelectedPage] = useState("")
  const [fields, setFields] = useState<Record<string, string>>({})
  const [serverFields, setServerFields] = useState<Record<string, string>>({})
  const [versions, setVersions] = useState<Record<string, FieldVersion[]>>({})
  const [versionsRemaining, setVersionsRemaining] = useState<Record<string, number>>({})
  const [activeTab, setActiveTab] = useState<EditorTab>("text")
  const [loading, setLoading] = useState(true)
  const [loadingPage, setLoadingPage] = useState(false)
  const [savingField, setSavingField] = useState<string | null>(null)
  const [savedField, setSavedField] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [historyOpenField, setHistoryOpenField] = useState<string | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [imagePreviewUrls, setImagePreviewUrls] = useState<Record<string, string>>({})
  const signedUrlCacheRef = useRef<Record<string, string>>({})

  const textFields = useMemo(
    () =>
      Object.keys(fields).filter(
        (key) =>
          !key.startsWith("meta.") &&
          !["slug", "title"].includes(key) &&
          typeof fields[key] === "string"
      ),
    [fields]
  )

  const imageFieldEntries = useMemo(
    () =>
      Object.entries(fields)
        .filter(([fieldKey, value]) => isImageField(fieldKey) && typeof value === "string")
        .map(([fieldKey, value]) => [fieldKey, value.trim()] as const)
        .filter(([, value]) => value.length > 0),
    [fields]
  )

  const imageFieldSignature = useMemo(() => JSON.stringify(imageFieldEntries), [imageFieldEntries])

  const loadPage = async (slug: string) => {
    setLoadingPage(true)
    setGlobalError(null)
    try {
      const [res, versionsRes] = await Promise.all([
        fetch(`/api/content/get-page?slug=${encodeURIComponent(slug)}`),
        fetch(`/api/content/versions?page=${encodeURIComponent(slug)}`),
      ])
      const data = (await res.json()) as GetPageResponse
      const versionsData = (await versionsRes.json()) as VersionsResponse
      if (!res.ok) throw new Error(data.error ?? "Failed to load page fields")
      if (!versionsRes.ok) throw new Error(versionsData.error ?? "Failed to load page versions")

      const nextFields: Record<string, string> = {}
      for (const [key, value] of Object.entries(data)) {
        if (key === "pageId" || key === "slug" || key === "error") continue
        if (typeof value === "string") {
          nextFields[key] = value
        }
      }

      setFields(nextFields)
      setServerFields(nextFields)
      setVersions(versionsData.versions ?? {})
      setHistoryOpenField(null)
      setFieldErrors({})
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "Failed to load page")
    } finally {
      setLoadingPage(false)
    }
  }

  useEffect(() => {
    const loadPages = async () => {
      setLoading(true)
      setGlobalError(null)
      try {
        const res = await fetch("/api/content/list-pages")
        const data = (await res.json()) as { pages?: PageOption[]; error?: string }
        if (!res.ok) throw new Error(data.error ?? "Failed to load pages")

        const pageList = data.pages ?? []
        setPages(pageList)
        if (pageList.length > 0) {
          setSelectedPage(pageList[0].slug)
          await loadPage(pageList[0].slug)
        }
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : "Failed to load pages")
      } finally {
        setLoading(false)
      }
    }

    void loadPages()
  }, [siteId])

  useEffect(() => {
    let cancelled = false

    const resolvePreviewUrls = async () => {
      const parsedEntries = JSON.parse(imageFieldSignature) as Array<[string, string]>
      const nextPreviewUrls: Record<string, string> = {}

      await Promise.all(
        parsedEntries.map(async ([fieldKey, value]) => {
          if (!value) return

          if (isHttpUrl(value)) {
            nextPreviewUrls[fieldKey] = value
            return
          }

          if (!isR2Key(value)) return

          const cached = signedUrlCacheRef.current[value]
          if (cached) {
            nextPreviewUrls[fieldKey] = cached
            return
          }

          try {
            const res = await fetch(`/api/images/signed-url?key=${encodeURIComponent(value)}`, {
              cache: "no-store",
            })
            const data = (await res.json()) as SignedUrlResponse
            if (res.ok && typeof data.url === "string") {
              signedUrlCacheRef.current[value] = data.url
              nextPreviewUrls[fieldKey] = data.url
            }
          } catch {
            // Ignore preview fetch errors; field editing still works.
          }
        })
      )

      if (!cancelled) {
        setImagePreviewUrls(nextPreviewUrls)
      }
    }

    void resolvePreviewUrls()

    return () => {
      cancelled = true
    }
  }, [imageFieldSignature, selectedPage])

  const setFieldValue = (fieldKey: string, value: string) => {
    setFields((prev) => ({ ...prev, [fieldKey]: value }))
  }

  const markSaved = (fieldKey: string) => {
    setSavedField(fieldKey)
    setTimeout(() => setSavedField((current) => (current === fieldKey ? null : current)), 2000)
  }

  const saveTextField = async (fieldKey: string) => {
    if (!selectedPage) return
    const value = fields[fieldKey] ?? ""
    const previousValue = serverFields[fieldKey] ?? ""

    setSavingField(fieldKey)
    setFieldErrors((prev) => ({ ...prev, [fieldKey]: "" }))
    try {
      const res = await fetch("/api/content/update-text", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: selectedPage,
          field: fieldKey,
          value,
        }),
      })
      const data = (await res.json()) as { error?: string; versionsRemaining?: number }
      if (!res.ok) throw new Error(data.error ?? "Failed to save field")

      setServerFields((prev) => ({ ...prev, [fieldKey]: value }))
      if (typeof data.versionsRemaining === "number") {
        setVersionsRemaining((prev) => ({ ...prev, [fieldKey]: data.versionsRemaining as number }))
      }
      markSaved(fieldKey)
      await loadPage(selectedPage)
    } catch (err) {
      setFields((prev) => ({ ...prev, [fieldKey]: previousValue }))
      setFieldErrors((prev) => ({
        ...prev,
        [fieldKey]: err instanceof Error ? err.message : "Save failed",
      }))
    } finally {
      setSavingField((current) => (current === fieldKey ? null : current))
    }
  }

  const saveSeoField = async (fieldKey: string, apiField: string) => {
    if (!selectedPage) return
    const value = fields[fieldKey] ?? ""
    const previousValue = serverFields[fieldKey] ?? ""

    setSavingField(fieldKey)
    setFieldErrors((prev) => ({ ...prev, [fieldKey]: "" }))
    try {
      const res = await fetch("/api/content/update-seo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: selectedPage,
          field: apiField,
          value,
        }),
      })
      const data = (await res.json()) as { error?: string; versionsRemaining?: number }
      if (!res.ok) throw new Error(data.error ?? "Failed to save SEO field")

      setServerFields((prev) => ({ ...prev, [fieldKey]: value }))
      if (typeof data.versionsRemaining === "number") {
        setVersionsRemaining((prev) => ({ ...prev, [fieldKey]: data.versionsRemaining as number }))
      }
      markSaved(fieldKey)
      await loadPage(selectedPage)
    } catch (err) {
      setFields((prev) => ({ ...prev, [fieldKey]: previousValue }))
      setFieldErrors((prev) => ({
        ...prev,
        [fieldKey]: err instanceof Error ? err.message : "Save failed",
      }))
    } finally {
      setSavingField((current) => (current === fieldKey ? null : current))
    }
  }

  const revertVersion = async (fieldKey: string, versionId: string) => {
    setSavingField(fieldKey)
    setFieldErrors((prev) => ({ ...prev, [fieldKey]: "" }))
    try {
      const res = await fetch("/api/content/revert", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      })
      const data = (await res.json()) as { error?: string; revertedTo?: string }
      if (!res.ok) throw new Error(data.error ?? "Failed to revert version")

      if (typeof data.revertedTo === "string") {
        setFields((prev) => ({ ...prev, [fieldKey]: data.revertedTo as string }))
        setServerFields((prev) => ({ ...prev, [fieldKey]: data.revertedTo as string }))
      }
      markSaved(fieldKey)
      await loadPage(selectedPage)
    } catch (err) {
      setFieldErrors((prev) => ({
        ...prev,
        [fieldKey]: err instanceof Error ? err.message : "Revert failed",
      }))
    } finally {
      setSavingField((current) => (current === fieldKey ? null : current))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-7 w-7 animate-spin rounded-full border-4 border-[var(--border-default)] border-t-[var(--accent-500)]" />
      </div>
    )
  }

  if (globalError) {
    return <p className="text-sm text-[var(--error)]">{globalError}</p>
  }

  if (pages.length === 0) {
    return <p className="text-sm text-[var(--text-secondary)]">No pages found in the connected Payload site.</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-[var(--text-secondary)]">Page</label>
        <select
          value={selectedPage}
          onChange={async (e) => {
            const slug = e.target.value
            setSelectedPage(slug)
            await loadPage(slug)
          }}
          className="rw-select w-auto min-w-52"
        >
          {pages.map((page) => (
            <option key={page.slug} value={page.slug}>
              {page.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 border-b border-[var(--border-subtle)]">
        <button
          onClick={() => setActiveTab("text")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
            activeTab === "text"
              ? "border-[var(--border-accent)] text-[var(--text-primary)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          Text Fields
        </button>
        <button
          onClick={() => setActiveTab("seo")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
            activeTab === "seo"
              ? "border-[var(--border-accent)] text-[var(--text-primary)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          SEO Fields
        </button>
      </div>

      {loadingPage ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-500)]" />
          Loading page fields...
        </div>
      ) : (
        <div className="space-y-6">
          {activeTab === "text" &&
            textFields.map((fieldKey) => {
              const value = fields[fieldKey] ?? ""
              const fieldVersions = versions[fieldKey] ?? []
              const isSaving = savingField === fieldKey
              const isSaved = savedField === fieldKey
              const previewUrl = imagePreviewUrls[fieldKey]

              return (
                <div key={fieldKey} className="rw-card p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{fieldKey}</p>
                    {typeof versionsRemaining[fieldKey] === "number" && (
                      <span className="text-xs text-[var(--text-secondary)]">
                        {versionsRemaining[fieldKey]} versions remaining
                      </span>
                    )}
                  </div>

                  {value.length > 120 ? (
                    <textarea
                      value={value}
                      onChange={(e) => setFieldValue(fieldKey, e.target.value)}
                      rows={4}
                      className="rw-textarea min-h-[120px]"
                    />
                  ) : (
                    <input
                      value={value}
                      onChange={(e) => setFieldValue(fieldKey, e.target.value)}
                      className="rw-input"
                    />
                  )}

                  {previewUrl && (
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt={`${fieldKey} preview`}
                        className="h-32 w-auto rounded-md object-cover"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => saveTextField(fieldKey)}
                      disabled={isSaving}
                      className="rw-btn rw-btn-primary px-3 py-1.5 text-xs"
                    >
                      <RiSaveLine className="h-3.5 w-3.5" />
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() =>
                        setHistoryOpenField((current) => (current === fieldKey ? null : fieldKey))
                      }
                      className="rw-btn rw-btn-secondary px-3 py-1.5 text-xs"
                    >
                      <RiHistoryLine className="h-3.5 w-3.5" />
                      History
                    </button>
                    {isSaved && (
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--success)]">
                        <RiCheckboxCircleLine className="h-3.5 w-3.5" />
                        Saved
                      </span>
                    )}
                  </div>

                  <ScheduledPublish page={selectedPage} field={fieldKey} value={value} />

                  {historyOpenField === fieldKey && (
                    <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                      <p className="text-xs font-semibold text-[var(--text-secondary)]">Version History</p>
                      {fieldVersions.length === 0 ? (
                        <p className="text-xs text-[var(--text-muted)]">No versions yet.</p>
                      ) : (
                        fieldVersions.slice(0, 10).map((version) => (
                          <div
                            key={version.id}
                            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 space-y-1"
                          >
                            <p className="text-xs text-[var(--text-muted)]">
                              {new Date(version.createdAt).toLocaleString()}
                            </p>
                            <p className="text-xs text-[var(--text-secondary)]">
                              Previous: <span className="font-medium">{version.oldValue}</span>
                            </p>
                            <button
                              onClick={() => revertVersion(fieldKey, version.id)}
                              className="rw-btn rw-btn-secondary px-2 py-1 text-xs"
                            >
                              <RiRefreshLine className="h-3 w-3" />
                              Revert
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {fieldErrors[fieldKey] && <p className="text-xs text-[var(--error)]">{fieldErrors[fieldKey]}</p>}
                </div>
              )
            })}

          {activeTab === "seo" &&
            seoFieldMap.map((seoField) => {
              const value = fields[seoField.key] ?? ""
              const fieldVersions = versions[seoField.apiField] ?? []
              const isSaving = savingField === seoField.key
              const isSaved = savedField === seoField.key
              const overLimit = typeof seoField.max === "number" && value.length > seoField.max
              const previewUrl = imagePreviewUrls[seoField.key]

              return (
                <div key={seoField.key} className="rw-card p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{seoField.label}</p>
                    <div className="flex items-center gap-2">
                      {typeof seoField.max === "number" && (
                        <span
                          className={`text-xs ${overLimit ? "font-semibold text-[var(--error)]" : "text-[var(--text-secondary)]"}`}
                        >
                          {value.length}/{seoField.max}
                        </span>
                      )}
                      {typeof versionsRemaining[seoField.key] === "number" && (
                        <span className="text-xs text-[var(--text-secondary)]">
                          {versionsRemaining[seoField.key]} versions remaining
                        </span>
                      )}
                    </div>
                  </div>

                  {seoField.multiline ? (
                    <textarea
                      value={value}
                      onChange={(e) => setFieldValue(seoField.key, e.target.value)}
                      rows={3}
                      className="rw-textarea min-h-[120px]"
                    />
                  ) : (
                    <input
                      value={value}
                      onChange={(e) => setFieldValue(seoField.key, e.target.value)}
                      className="rw-input"
                    />
                  )}

                  {previewUrl && (
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt={`${seoField.label} preview`}
                        className="h-32 w-auto rounded-md object-cover"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => saveSeoField(seoField.key, seoField.apiField)}
                      disabled={isSaving}
                      className="rw-btn rw-btn-primary px-3 py-1.5 text-xs"
                    >
                      <RiSaveLine className="h-3.5 w-3.5" />
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() =>
                        setHistoryOpenField((current) =>
                          current === seoField.key ? null : seoField.key
                        )
                      }
                      className="rw-btn rw-btn-secondary px-3 py-1.5 text-xs"
                    >
                      <RiHistoryLine className="h-3.5 w-3.5" />
                      History
                    </button>
                    {isSaved && (
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--success)]">
                        <RiCheckboxCircleLine className="h-3.5 w-3.5" />
                        Saved
                      </span>
                    )}
                  </div>

                  <ScheduledPublish page={selectedPage} field={seoField.key} value={value} />

                  {historyOpenField === seoField.key && (
                    <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                      <p className="text-xs font-semibold text-[var(--text-secondary)]">Version History</p>
                      {fieldVersions.length === 0 ? (
                        <p className="text-xs text-[var(--text-muted)]">No versions yet.</p>
                      ) : (
                        fieldVersions.slice(0, 10).map((version) => (
                          <div
                            key={version.id}
                            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 space-y-1"
                          >
                            <p className="text-xs text-[var(--text-muted)]">
                              {new Date(version.createdAt).toLocaleString()}
                            </p>
                            <p className="text-xs text-[var(--text-secondary)]">
                              Previous: <span className="font-medium">{version.oldValue}</span>
                            </p>
                            <button
                              onClick={() => revertVersion(seoField.key, version.id)}
                              className="rw-btn rw-btn-secondary px-2 py-1 text-xs"
                            >
                              <RiRefreshLine className="h-3 w-3" />
                              Revert
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {fieldErrors[seoField.key] && (
                    <p className="text-xs text-[var(--error)]">{fieldErrors[seoField.key]}</p>
                  )}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
