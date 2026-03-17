import { getPageFromPayload, updatePageInPayload } from "@/lib/payload-client"
import { prisma } from "@/lib/prisma"
import { triggerRebuild } from "@/lib/rebuild"
import { createVersionSnapshot, getMaxVersions } from "@/lib/version-snapshot"
import { ChangeSource, Site, SubscriptionTier } from "@prisma/client"

export type SeoField =
  | "metaTitle"
  | "metaDescription"
  | "ogTitle"
  | "ogDescription"
  | "ogImage"

export class ContentMutationError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ContentMutationError"
    this.status = status
  }
}

const SEO_FIELD_MAP: Record<SeoField, string> = {
  metaTitle: "meta.title",
  metaDescription: "meta.description",
  ogTitle: "meta.ogTitle",
  ogDescription: "meta.ogDescription",
  ogImage: "meta.ogImage",
}

function buildNestedPatch(path: string, value: string): Record<string, unknown> {
  const keys = path.split(".")
  const root: Record<string, unknown> = {}
  let current: Record<string, unknown> = root

  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      current[key] = value
      return
    }

    const next: Record<string, unknown> = {}
    current[key] = next
    current = next
  })

  return root
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".")
  let value: unknown = obj

  for (const key of keys) {
    if (!value || typeof value !== "object") return undefined
    value = (value as Record<string, unknown>)[key]
  }

  return value
}

interface ApplySeoFieldUpdateArgs {
  site: Site
  page: string
  field: SeoField
  value: string
  userId: string
  subscriptionTier: SubscriptionTier
}

export async function applySeoFieldUpdate({
  site,
  page: pageSlug,
  field,
  value,
  userId,
  subscriptionTier,
}: ApplySeoFieldUpdateArgs): Promise<{ success: true; versionsRemaining: number }> {
  const fieldKey = SEO_FIELD_MAP[field]
  if (!fieldKey) {
    throw new ContentMutationError("Invalid SEO field", 400)
  }

  const { data: pageData, error: pageError, status: pageStatus } = await getPageFromPayload(
    site,
    pageSlug
  )
  if (pageError) {
    throw new ContentMutationError(pageError, pageStatus)
  }

  const pageDoc = (pageData as { docs?: Array<Record<string, unknown>> } | null)?.docs?.[0]
  if (!pageDoc || typeof pageDoc.id !== "string") {
    throw new ContentMutationError("Page not found", 404)
  }

  const previousValue = String(getNestedValue(pageDoc, fieldKey) ?? "")
  const maxVersions = getMaxVersions(subscriptionTier)
  const resolvedPageSlug =
    typeof pageDoc.slug === "string" && pageDoc.slug.length > 0 ? pageDoc.slug : pageSlug

  await createVersionSnapshot({
    siteId: site.id,
    pageSlug: resolvedPageSlug,
    fieldKey,
    previousValue,
    newValue: value,
    changedBy: userId,
    source: ChangeSource.MANUAL,
    maxVersions,
  })

  const updateData = buildNestedPatch(fieldKey, value)
  const { error: updateError, status: updateStatus } = await updatePageInPayload(
    site,
    pageDoc.id,
    updateData
  )
  if (updateError) {
    throw new ContentMutationError(updateError, updateStatus)
  }

  await triggerRebuild(site.repoUrl ?? "", {
    source: "platform-seo-update",
    page: resolvedPageSlug,
    field,
    triggeredBy: userId,
  })

  const versionCount = await prisma.versionSnapshot.count({
    where: {
      siteId: site.id,
      pageSlug: resolvedPageSlug,
      fieldKey,
    },
  })

  return {
    success: true,
    versionsRemaining: Math.max(maxVersions - versionCount, 0),
  }
}
