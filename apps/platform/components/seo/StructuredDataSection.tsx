"use client"

import { useEffect, useState } from "react"

import StructuredDataEditor from "@/components/seo/StructuredDataEditor"

interface PageOption {
  slug: string
  title: string
}

interface PagesResponse {
  pages?: PageOption[]
  error?: string
}

interface StructuredDataResponse {
  schema?: unknown
  error?: string
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export default function StructuredDataSection() {
  const [pages, setPages] = useState<PageOption[]>([{ slug: "home", title: "Home" }])
  const [pageSlug, setPageSlug] = useState("home")
  const [schema, setSchema] = useState<Record<string, unknown> | null>(null)
  const [loadingPages, setLoadingPages] = useState(true)
  const [loadingSchema, setLoadingSchema] = useState(true)

  useEffect(() => {
    let active = true

    async function loadPages() {
      setLoadingPages(true)
      try {
        const response = await fetch("/api/content/list-pages", { cache: "no-store" })
        const data = (await response.json()) as PagesResponse

        if (!active || !response.ok || !Array.isArray(data.pages) || data.pages.length === 0) {
          return
        }

        setPages(data.pages)
        setPageSlug((current) => {
          const currentStillExists = data.pages?.some((page) => page.slug === current)
          return currentStillExists ? current : data.pages?.[0]?.slug ?? "home"
        })
      } catch {
        // Fall back to the default page list if Payload is unavailable.
      } finally {
        if (active) {
          setLoadingPages(false)
        }
      }
    }

    void loadPages()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadSchema() {
      setLoadingSchema(true)
      try {
        const response = await fetch(
          `/api/seo/structured-data?pageSlug=${encodeURIComponent(pageSlug)}`,
          { cache: "no-store" }
        )
        const data = (await response.json()) as StructuredDataResponse

        if (!active) return

        if (!response.ok) {
          setSchema(null)
          return
        }

        setSchema(isPlainObject(data.schema) ? data.schema : null)
      } catch {
        if (!active) return
        setSchema(null)
      } finally {
        if (active) {
          setLoadingSchema(false)
        }
      }
    }

    void loadSchema()

    return () => {
      active = false
    }
  }, [pageSlug])

  return (
    <section className="rw-card p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor="structured-data-page" className="text-sm font-medium text-[var(--text-secondary)]">
          Page
        </label>
        <select
          id="structured-data-page"
          value={pageSlug}
          disabled={loadingPages || loadingSchema}
          onChange={(event) => setPageSlug(event.target.value)}
          className="rw-select w-auto min-w-44"
        >
          {pages.map((page) => (
            <option key={page.slug} value={page.slug}>
              {page.title}
            </option>
          ))}
        </select>
        {loadingSchema ? <span className="text-xs text-[var(--text-muted)]">Loading...</span> : null}
      </div>

      <StructuredDataEditor initialSchema={schema} pageSlug={pageSlug} />
    </section>
  )
}
