import { auth } from "@/lib/auth"
import { getPageFromPayload } from "@/lib/payload-client"
import { prisma } from "@/lib/prisma"
import { getUserSubscription } from "@/lib/site-access"
import { SubscriptionStatus } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

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

  if (Array.isArray(value)) return out
  if (typeof value !== "object") return out

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

  const { searchParams } = new URL(req.url)
  const slug = searchParams.get("slug")
  const includeVersions = searchParams.get("includeVersions") === "1"
  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 })
  }

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
  })
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 })
  if (!site.domainVerified || !site.linked) {
    return NextResponse.json({ error: "Site must be verified and linked first" }, { status: 403 })
  }

  const subscription = await getUserSubscription(session.user.id)
  if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
    return NextResponse.json({ error: "Active subscription required" }, { status: 403 })
  }

  const { data, error, status } = await getPageFromPayload(site, slug)
  if (error) return NextResponse.json({ error }, { status })

  const page = (data as { docs?: Array<Record<string, unknown>> } | null)?.docs?.[0]
  if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 })

  const fields = flattenFields(page)

  if (!includeVersions) {
    return NextResponse.json(fields)
  }

  const versionsRaw = await prisma.versionSnapshot.findMany({
    where: { siteId: site.id, pageSlug: slug },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      fieldKey: true,
      previousValue: true,
      newValue: true,
      createdAt: true,
    },
  })

  const versions: Record<
    string,
    Array<{ id: string; previousValue: string; newValue: string; createdAt: string }>
  > = {}

  for (const row of versionsRaw) {
    if (!versions[row.fieldKey]) versions[row.fieldKey] = []
    versions[row.fieldKey].push({
      id: row.id,
      previousValue: row.previousValue,
      newValue: row.newValue,
      createdAt: row.createdAt.toISOString(),
    })
  }

  return NextResponse.json({ fields, versions })
}
