import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { triggerRebuild } from "@/lib/rebuild"
import { NextRequest, NextResponse } from "next/server"

interface RevertBody {
  versionId?: string
}

interface PayloadPageResponse {
  docs?: Array<Record<string, unknown>>
}

const SEO_FIELD_PATHS: Record<string, string[]> = {
  metaTitle: ["meta", "title"],
  metaDescription: ["meta", "description"],
  ogTitle: ["openGraph", "title"],
  ogDescription: ["openGraph", "description"],
  ogImage: ["openGraph", "url"],
}

function resolveFieldPath(field: string): string[] {
  if (SEO_FIELD_PATHS[field]) return SEO_FIELD_PATHS[field]
  const path = field.split(".").filter(Boolean)
  return path.length > 0 ? path : [field]
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

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: RevertBody
  try {
    body = (await req.json()) as RevertBody
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!body.versionId) {
    return NextResponse.json({ error: "versionId is required" }, { status: 400 })
  }

  const version = await prisma.contentVersion.findUnique({
    where: { id: body.versionId },
    select: {
      id: true,
      siteId: true,
      page: true,
      field: true,
      oldValue: true,
      site: {
        select: {
          ownerId: true,
          payloadUrl: true,
          repoUrl: true,
        },
      },
    },
  })

  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 })
  }

  if (version.site.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!version.site.payloadUrl) {
    return NextResponse.json({ error: "Payload fetch failed" }, { status: 502 })
  }

  let pageDoc: Record<string, unknown> | undefined

  try {
    const pageResponse = await fetch(
      `${version.site.payloadUrl}/api/pages?where[slug][equals]=${encodeURIComponent(version.page)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }
    )

    if (!pageResponse.ok) {
      return NextResponse.json({ error: "Payload fetch failed" }, { status: 502 })
    }

    const pageData = (await pageResponse.json()) as PayloadPageResponse
    pageDoc = pageData.docs?.[0]
  } catch {
    return NextResponse.json({ error: "Payload fetch failed" }, { status: 502 })
  }

  if (!pageDoc || typeof pageDoc.id !== "string") {
    return NextResponse.json({ error: "Page not found" }, { status: 404 })
  }

  const fieldPath = resolveFieldPath(version.field)
  const currentPayloadValue = String(getNestedValue(pageDoc, fieldPath) ?? "")
  const patchPayload = buildNestedPatch(fieldPath, version.oldValue)

  try {
    const patchResponse = await fetch(`${version.site.payloadUrl}/api/pages/${pageDoc.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patchPayload),
    })

    if (!patchResponse.ok) {
      return NextResponse.json({ error: "Payload fetch failed" }, { status: 502 })
    }
  } catch {
    return NextResponse.json({ error: "Payload fetch failed" }, { status: 502 })
  }

  await prisma.contentVersion.create({
    data: {
      siteId: version.siteId,
      page: version.page,
      field: version.field,
      oldValue: currentPayloadValue,
      newValue: version.oldValue,
    },
  })

  await triggerRebuild(`${version.site.repoUrl ?? ""}/dispatches`, {
    event_type: "content-update",
    client_payload: { page: version.page, field: version.field },
  })

  return NextResponse.json({ success: true, revertedTo: version.oldValue })
}
