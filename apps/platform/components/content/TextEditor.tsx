"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, Clock3, RotateCcw, Save } from "lucide-react"
import ScheduledPublish from "@/components/content/ScheduledPublish"

interface PageOption {
  slug: string
  title: string
}

interface FieldVersion {
  id: string
  previousValue: string
  newValue: string
  createdAt: string
}

interface GetPageWithVersions {
  fields: Record<string, string>
  versions: Record<string, FieldVersion[]>
}

export default function TextEditor() {
  const [pages, setPages] = useState<PageOption[]>([])
  const [selectedPage, setSelectedPage] = useState("")
  const [fields, setFields] = useState<Record<string, string>>({})
  const [serverFields, setServerFields] = useState<Record<string, string>>({})
  const [versions, setVersions] = useState<Record<string, FieldVersion[]>>({})
  const [versionsRemaining, setVersionsRemaining] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [loadingPage, setLoadingPage] = useState(false)
  const [savingField, setSavingField] = useState<string | null>(null)
  const [savedField, setSavedField] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [historyOpenField, setHistoryOpenField] = useState<string | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)

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

  const loadPage = async (slug: string) => {
    setLoadingPage(true)
    setGlobalError(null)
    try {
      const res = await fetch(`/api/content/get-page?slug=${encodeURIComponent(slug)}&includeVersions=1`)
      const data = (await res.json()) as GetPageWithVersions & { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Failed to load page fields")

      const nextFields = data.fields ?? {}
      setFields(nextFields)
      setServerFields(nextFields)
      setVersions(data.versions ?? {})
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
        const data = (await res.json()) as PageOption[] | { error?: string }
        if (!res.ok) {
          const message = (data as { error?: string }).error ?? "Failed to load pages"
          throw new Error(message)
        }

        const pageList = Array.isArray(data) ? data : []
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
  }, [])

  const markSaved = (fieldKey: string) => {
    setSavedField(fieldKey)
    setTimeout(() => setSavedField((current) => (current === fieldKey ? null : current)), 2000)
  }

  const saveField = async (fieldKey: string) => {
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
        <div className="w-7 h-7 rounded-full border-4 border-gray-200 border-t-gray-900 animate-spin" />
      </div>
    )
  }

  if (globalError) {
    return <p className="text-sm text-red-600">{globalError}</p>
  }

  if (pages.length === 0) {
    return <p className="text-sm text-gray-500">No pages found in the connected Payload site.</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Page</label>
        <select
          value={selectedPage}
          onChange={async (e) => {
            const slug = e.target.value
            setSelectedPage(slug)
            await loadPage(slug)
          }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          {pages.map((page) => (
            <option key={page.slug} value={page.slug}>
              {page.title}
            </option>
          ))}
        </select>
      </div>

      {loadingPage ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-gray-900 animate-spin" />
          Loading page fields...
        </div>
      ) : (
        <div className="space-y-6">
          {textFields.map((fieldKey) => {
            const value = fields[fieldKey] ?? ""
            const fieldVersions = versions[fieldKey] ?? []
            const isSaving = savingField === fieldKey
            const isSaved = savedField === fieldKey

            return (
              <div key={fieldKey} className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-gray-800">{fieldKey}</p>
                  {typeof versionsRemaining[fieldKey] === "number" && (
                    <span className="text-xs text-gray-500">
                      {versionsRemaining[fieldKey]} versions remaining
                    </span>
                  )}
                </div>

                {value.length > 120 ? (
                  <textarea
                    value={value}
                    onChange={(e) => setFields((prev) => ({ ...prev, [fieldKey]: e.target.value }))}
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                ) : (
                  <input
                    value={value}
                    onChange={(e) => setFields((prev) => ({ ...prev, [fieldKey]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => saveField(fieldKey)}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-gray-700 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() =>
                      setHistoryOpenField((current) => (current === fieldKey ? null : fieldKey))
                    }
                    className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50"
                  >
                    <Clock3 className="w-3.5 h-3.5" />
                    History
                  </button>
                  {isSaved && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-700">
                      <Check className="w-3.5 h-3.5" />
                      Saved
                    </span>
                  )}
                </div>

                <ScheduledPublish page={selectedPage} field={fieldKey} value={value} />

                {historyOpenField === fieldKey && (
                  <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                    <p className="text-xs font-semibold text-gray-600">Version History</p>
                    {fieldVersions.length === 0 ? (
                      <p className="text-xs text-gray-500">No versions yet.</p>
                    ) : (
                      fieldVersions.slice(0, 10).map((version) => (
                        <div
                          key={version.id}
                          className="border border-gray-200 bg-white rounded-md p-2 space-y-1"
                        >
                          <p className="text-xs text-gray-500">
                            {new Date(version.createdAt).toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-700">
                            Previous: <span className="font-medium">{version.previousValue}</span>
                          </p>
                          <button
                            onClick={() => revertVersion(fieldKey, version.id)}
                            className="inline-flex items-center gap-1 text-xs text-gray-700 border border-gray-300 rounded-md px-2 py-1 hover:bg-gray-50"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Revert
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {fieldErrors[fieldKey] && <p className="text-xs text-red-600">{fieldErrors[fieldKey]}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
