"use client"

import { useState, useEffect } from "react"
import { Save, RotateCcw, Globe, FileText, Search } from "lucide-react"

interface Page {
  id: string
  title: string
  slug: string
  hero?: {
    heading?: string
    subheading?: string
    ctaText?: string
  }
  meta?: {
    title?: string
    description?: string
    noIndex?: boolean
  }
}

interface ContentEditorProps {
  siteId: string
}

type EditorTab = "text" | "seo"

interface ListPagesResponse {
  pages?: {
    docs?: Page[]
  } | null
}

export default function ContentEditor({ siteId }: ContentEditorProps) {
  const [pages, setPages] = useState<Page[]>([])
  const [selectedPage, setSelectedPage] = useState<Page | null>(null)
  const [activeTab, setActiveTab] = useState<EditorTab>("text")
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle")
  const [editedFields, setEditedFields] = useState<Record<string, string>>({})
  const [isLoadingPages, setIsLoadingPages] = useState(true)

  // Fetch pages on mount
  useEffect(() => {
    async function fetchPages() {
      try {
        const res = await fetch(`/api/content/list-pages?siteId=${siteId}`)
        if (res.ok) {
          const data = (await res.json()) as ListPagesResponse
          const pageList = data.pages?.docs ?? []
          setPages(pageList)
          if (pageList.length > 0) setSelectedPage(pageList[0])
        }
      } catch (err) {
        console.error("Failed to fetch pages:", err)
      } finally {
        setIsLoadingPages(false)
      }
    }
    fetchPages()
  }, [siteId])

  function handleFieldChange(fieldKey: string, value: string) {
    setEditedFields((prev) => ({ ...prev, [fieldKey]: value }))
    setSaveStatus("idle")
  }

  async function handleSaveText() {
    if (!selectedPage || Object.keys(editedFields).length === 0) return
    setIsSaving(true)
    setSaveStatus("idle")

    try {
      for (const [fieldKey, newValue] of Object.entries(editedFields)) {
        const previousValue = getFieldValue(selectedPage, fieldKey) ?? ""
        const isSeoField = fieldKey.startsWith("meta.")

        if (isSeoField) {
          const previousValues = {
            metaTitle: getFieldValue(selectedPage, "meta.title"),
            metaDescription: getFieldValue(selectedPage, "meta.description"),
            noIndex: getFieldValue(selectedPage, "meta.noIndex") === "true",
          }
          const payload: Record<string, unknown> = {
            siteId,
            pageId: selectedPage.id,
            pageSlug: selectedPage.slug,
            previousValues,
          }
          if (fieldKey === "meta.title") payload.metaTitle = newValue
          if (fieldKey === "meta.description") payload.metaDescription = newValue
          if (fieldKey === "meta.noIndex") payload.noIndex = newValue === "true"

          const res = await fetch("/api/content/update-seo", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
          if (!res.ok) {
            if (res.status !== 429) setSaveStatus("error")
            return
          }
        } else {
          const res = await fetch("/api/content/update-text", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              siteId,
              pageId: selectedPage.id,
              pageSlug: selectedPage.slug,
              fieldKey,
              previousValue,
              newValue,
            }),
          })
          if (!res.ok) {
            if (res.status !== 429) setSaveStatus("error")
            return
          }
        }
      }
      setSaveStatus("saved")
      setEditedFields({})
      setTimeout(() => setSaveStatus("idle"), 3000)
    } catch {
      setSaveStatus("error")
    } finally {
      setIsSaving(false)
    }
  }

  function getFieldValue(page: Page, fieldKey: string): string {
    const parts = fieldKey.split(".")
    let value: unknown = page
    for (const part of parts) {
      value = (value as Record<string, unknown>)?.[part]
    }
    return String(value ?? "")
  }

  function getEditedOrOriginal(fieldKey: string): string {
    return editedFields[fieldKey] ?? getFieldValue(selectedPage!, fieldKey)
  }

  if (isLoadingPages) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (pages.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <FileText className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">No pages found</p>
        <p className="text-gray-400 text-sm mt-1">
          Add pages to your site in the Payload CMS admin panel first.
        </p>
      </div>
    )
  }

  return (
    <div className="flex gap-6 h-full">
      {/* Page list sidebar */}
      <div className="w-56 shrink-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pages</p>
        <div className="space-y-1">
          {pages.map((page) => (
            <button
              key={page.id}
              onClick={() => { setSelectedPage(page); setEditedFields({}) }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPage?.id === page.id
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Globe className="w-3.5 h-3.5 inline mr-2 opacity-60" />
              {page.title}
            </button>
          ))}
        </div>
      </div>

      {/* Editor panel */}
      {selectedPage && (
        <div className="flex-1 min-w-0">
          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("text")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "text"
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <FileText className="w-4 h-4 inline mr-1.5" />
              Text Content
            </button>
            <button
              onClick={() => setActiveTab("seo")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "seo"
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Search className="w-4 h-4 inline mr-1.5" />
              SEO
            </button>
          </div>

          {/* Text content tab */}
          {activeTab === "text" && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hero Heading
                </label>
                <input
                  type="text"
                  value={getEditedOrOriginal("hero.heading")}
                  onChange={(e) => handleFieldChange("hero.heading", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Enter hero heading..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hero Subheading
                </label>
                <textarea
                  value={getEditedOrOriginal("hero.subheading")}
                  onChange={(e) => handleFieldChange("hero.subheading", e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                  placeholder="Enter hero subheading..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CTA Button Text
                </label>
                <input
                  type="text"
                  value={getEditedOrOriginal("hero.ctaText")}
                  onChange={(e) => handleFieldChange("hero.ctaText", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Enter CTA button text..."
                />
              </div>
            </div>
          )}

          {/* SEO tab */}
          {activeTab === "seo" && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meta Title
                  <span className="text-gray-400 font-normal ml-2 text-xs">
                    ({getEditedOrOriginal("meta.title").length}/60 characters)
                  </span>
                </label>
                <input
                  type="text"
                  value={getEditedOrOriginal("meta.title")}
                  onChange={(e) => handleFieldChange("meta.title", e.target.value)}
                  maxLength={60}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Enter meta title..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meta Description
                  <span className="text-gray-400 font-normal ml-2 text-xs">
                    ({getEditedOrOriginal("meta.description").length}/160 characters)
                  </span>
                </label>
                <textarea
                  value={getEditedOrOriginal("meta.description")}
                  onChange={(e) => handleFieldChange("meta.description", e.target.value)}
                  maxLength={160}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                  placeholder="Enter meta description..."
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="noIndex"
                  checked={getEditedOrOriginal("meta.noIndex") === "true"}
                  onChange={(e) => handleFieldChange("meta.noIndex", String(e.target.checked))}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="noIndex" className="text-sm font-medium text-gray-700">
                  No Index (hide this page from search engines)
                </label>
              </div>
            </div>
          )}

          {/* Save bar */}
          {Object.keys(editedFields).length > 0 && (
            <div className="mt-8 flex items-center gap-3">
              <button
                onClick={handleSaveText}
                disabled={isSaving}
                className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "Saving..." : "Save changes"}
              </button>
              <button
                onClick={() => setEditedFields({})}
                className="flex items-center gap-2 text-gray-500 px-4 py-2.5 rounded-lg text-sm hover:bg-gray-100 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Discard
              </button>
              {saveStatus === "saved" && (
                <span className="text-green-600 text-sm font-medium">
                  ✓ Saved — site rebuilding...
                </span>
              )}
              {saveStatus === "error" && (
                <span className="text-red-600 text-sm font-medium">
                  Failed to save. Try again.
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
