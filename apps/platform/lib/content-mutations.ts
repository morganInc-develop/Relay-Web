import { prisma } from "@/lib/prisma"
import { triggerRebuild } from "@/lib/rebuild"
import { getVersionLimit } from "@/lib/version-limit"

export type SeoField = "metaTitle" | "metaDescription" | "ogTitle" | "ogDescription" | "ogImage"
export type TextField = "heading" | "subheading" | "body" | "buttonText" | "ctaText"

interface SiteMutationContext {
  id: string
  payloadUrl: string | null
  repoUrl: string | null
}

interface PayloadPageResponse {
  docs?: Array<Record<string, unknown>>
}

const SEO_FIELD_PATHS: Record<SeoField, string[]> = {
  metaTitle: ["meta", "title"],
  metaDescription: ["meta", "description"],
  ogTitle: ["openGraph", "title"],
  ogDescription: ["openGraph", "description"],
  ogImage: ["openGraph", "url"],
}

const TEXT_FIELDS = new Set<TextField>([
  "heading",
  "subheading",
  "body",
  "buttonText",
  "ctaText",
])

function isTextField(field: string): boolean {
  if (TEXT_FIELDS.has(field as TextField)) return true
  return field.trim().length > 0 && !isSeoField(field)
}

export class ContentMutationError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ContentMutationError"
    this.status = status
  }
}

function isSeoField(field: string): field is SeoField {
  return field in SEO_FIELD_PATHS
}

function getNestedValue(value: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = value
  for (const segment of path) {
    if (!current || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function buildNestedPatch(path: string[], value: string): Record<string, unknown> {
  const root: Record<string, unknown> = {}
  let cursor = root

  path.forEach((segment, index) => {
    if (index === path.length - 1) {
      cursor[segment] = value
      return
    }

    const next: Record<string, unknown> = {}
    cursor[segment] = next
    cursor = next
  })

  return root
}

interface ApplySeoFieldUpdateArgs {
  site: SiteMutationContext
  page: string
  field: string
  value: string
  stripePriceId: string | null | undefined
}

interface ApplyTextFieldUpdateArgs {
  site: SiteMutationContext
  page: string
  field: string
  value: string
  stripePriceId: string | null | undefined
}

export async function applySeoFieldUpdate({
  site,
  page,
  field,
  value,
  stripePriceId,
}: ApplySeoFieldUpdateArgs): Promise<{ success: true; versionsRemaining: number; oldValue: string }> {
  if (!isSeoField(field)) {
    throw new ContentMutationError(`Invalid SEO field: ${field}`, 400)
  }

  if (!site.payloadUrl) {
    throw new ContentMutationError("Payload fetch failed", 502)
  }

  const limit = getVersionLimit(stripePriceId)
  const count = await prisma.contentVersion.count({
    where: {
      siteId: site.id,
      page,
      field,
    },
  })

  if (count >= limit) {
    const oldest = await prisma.contentVersion.findFirst({
      where: {
        siteId: site.id,
        page,
        field,
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    })

    if (oldest) {
      await prisma.contentVersion.deleteMany({ where: { id: oldest.id } })
    }
  }

  let pageDoc: Record<string, unknown> | undefined
  try {
    const pageResponse = await fetch(
      `${site.payloadUrl}/api/pages?where[slug][equals]=${encodeURIComponent(page)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }
    )

    if (!pageResponse.ok) {
      throw new ContentMutationError("Payload fetch failed", 502)
    }

    const pageData = (await pageResponse.json()) as PayloadPageResponse
    pageDoc = pageData.docs?.[0]
  } catch (error) {
    if (error instanceof ContentMutationError) throw error
    throw new ContentMutationError("Payload fetch failed", 502)
  }

  if (!pageDoc || typeof pageDoc.id !== "string") {
    throw new ContentMutationError("Page not found", 404)
  }

  const oldValue = String(getNestedValue(pageDoc, SEO_FIELD_PATHS[field]) ?? "")
  await prisma.contentVersion.create({
    data: {
      siteId: site.id,
      page,
      field,
      oldValue,
      newValue: value,
    },
  })

  const patchPayload = buildNestedPatch(SEO_FIELD_PATHS[field], value)
  try {
    const patchResponse = await fetch(`${site.payloadUrl}/api/pages/${pageDoc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchPayload),
    })

    if (!patchResponse.ok) {
      throw new ContentMutationError("Payload fetch failed", 502)
    }
  } catch (error) {
    if (error instanceof ContentMutationError) throw error
    throw new ContentMutationError("Payload fetch failed", 502)
  }

  await triggerRebuild(`${site.repoUrl ?? ""}/dispatches`, {
    event_type: "seo-update",
    client_payload: { page, field },
  })

  return {
    success: true,
    versionsRemaining: limit - (count >= limit ? limit : count + 1),
    oldValue,
  }
}

export async function applyTextFieldUpdate({
  site,
  page,
  field,
  value,
  stripePriceId,
}: ApplyTextFieldUpdateArgs): Promise<{ success: true; versionsRemaining: number; oldValue: string }> {
  if (!isTextField(field)) {
    throw new ContentMutationError(`Invalid text field: ${field}`, 400)
  }

  if (!site.payloadUrl) {
    throw new ContentMutationError("Payload fetch failed", 502)
  }

  const limit = getVersionLimit(stripePriceId)
  const count = await prisma.contentVersion.count({
    where: {
      siteId: site.id,
      page,
      field,
    },
  })

  if (count >= limit) {
    const oldest = await prisma.contentVersion.findFirst({
      where: {
        siteId: site.id,
        page,
        field,
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    })

    if (oldest) {
      await prisma.contentVersion.deleteMany({ where: { id: oldest.id } })
    }
  }

  let pageDoc: Record<string, unknown> | undefined
  try {
    const pageResponse = await fetch(
      `${site.payloadUrl}/api/pages?where[slug][equals]=${encodeURIComponent(page)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }
    )

    if (!pageResponse.ok) {
      throw new ContentMutationError("Payload fetch failed", 502)
    }

    const pageData = (await pageResponse.json()) as PayloadPageResponse
    pageDoc = pageData.docs?.[0]
  } catch (error) {
    if (error instanceof ContentMutationError) throw error
    throw new ContentMutationError("Payload fetch failed", 502)
  }

  if (!pageDoc || typeof pageDoc.id !== "string") {
    throw new ContentMutationError("Page not found", 404)
  }

  const oldValue = String(pageDoc[field] ?? "")
  await prisma.contentVersion.create({
    data: {
      siteId: site.id,
      page,
      field,
      oldValue,
      newValue: value,
    },
  })

  try {
    const patchResponse = await fetch(`${site.payloadUrl}/api/pages/${pageDoc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    })

    if (!patchResponse.ok) {
      throw new ContentMutationError("Payload fetch failed", 502)
    }
  } catch (error) {
    if (error instanceof ContentMutationError) throw error
    throw new ContentMutationError("Payload fetch failed", 502)
  }

  await triggerRebuild(`${site.repoUrl ?? ""}/dispatches`, {
    event_type: "content-update",
    client_payload: { page, field },
  })

  return {
    success: true,
    versionsRemaining: limit - (count >= limit ? limit : count + 1),
    oldValue,
  }
}
