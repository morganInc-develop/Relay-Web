import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

interface PayloadPageResponse {
  docs?: Array<Record<string, unknown>>
}

function flattenFields(
  value: unknown,
  prefix = "",
  out: Record<string, string> = {}
): Record<string, string> {
  if (value === null || value === undefined) return out

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    if (prefix) out[prefix] = String(value)
    return out
  }

  if (Array.isArray(value) || typeof value !== "object") return out

  for (const [key, next] of Object.entries(value as Record<string, unknown>)) {
    if (["id", "createdAt", "updatedAt", "_status"].includes(key)) continue
    const path = prefix ? `${prefix}.${key}` : key
    flattenFields(next, path, out)
  }

  return out
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const slug = req.nextUrl.searchParams.get("slug")
  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 })
  }

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      payloadUrl: true,
      domainVerified: true,
      linked: true,
    },
  })

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 })
  }

  if (!site.domainVerified || !site.linked) {
    return NextResponse.json({ error: "Site must be verified and linked first" }, { status: 403 })
  }

  if (!site.payloadUrl) {
    return NextResponse.json({ error: "Payload fetch failed" }, { status: 502 })
  }

  let page: Record<string, unknown> | undefined

  try {
    const response = await fetch(
      `${site.payloadUrl}/api/pages?where[slug][equals]=${encodeURIComponent(slug)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      }
    )

    if (!response.ok) {
      return NextResponse.json({ error: "Payload fetch failed" }, { status: 502 })
    }

    const data = (await response.json()) as PayloadPageResponse
    page = data.docs?.[0]
  } catch {
    return NextResponse.json({ error: "Payload fetch failed" }, { status: 502 })
  }

  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 })
  }

  const pageId = typeof page.id === "string" ? page.id : null
  if (!pageId) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 })
  }

  const fields = flattenFields(page)

  return NextResponse.json({
    pageId,
    slug,
    ...fields,
  })
}
