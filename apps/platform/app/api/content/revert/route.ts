import { auth } from "@/lib/auth"
import { getPageFromPayload, updatePageInPayload } from "@/lib/payload-client"
import { prisma } from "@/lib/prisma"
import { checkRateLimit, rateLimiters } from "@/lib/rate-limit"
import { triggerRebuild } from "@/lib/rebuild"
import { getUserSubscription } from "@/lib/site-access"
import { createVersionSnapshot, getMaxVersions } from "@/lib/version-snapshot"
import { ChangeSource, SubscriptionStatus } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

interface RevertBody {
  versionId: string
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

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rateLimit = await checkRateLimit(rateLimiters.contentUpdate, session.user.id)
  if (!rateLimit.success) return rateLimit.response!

  let body: RevertBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!body.versionId) {
    return NextResponse.json({ error: "versionId is required" }, { status: 400 })
  }

  const version = await prisma.versionSnapshot.findUnique({
    where: { id: body.versionId },
    include: { site: true },
  })

  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 })
  if (version.site.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (!version.site.domainVerified || !version.site.linked) {
    return NextResponse.json({ error: "Site must be verified and linked first" }, { status: 403 })
  }

  const subscription = await getUserSubscription(session.user.id)
  if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
    return NextResponse.json({ error: "Active subscription required" }, { status: 403 })
  }

  const { data: pageData, error: pageError, status: pageStatus } = await getPageFromPayload(
    version.site,
    version.pageSlug
  )
  if (pageError) return NextResponse.json({ error: pageError }, { status: pageStatus })

  const pageDoc = (pageData as { docs?: Array<Record<string, unknown>> } | null)?.docs?.[0]
  if (!pageDoc || typeof pageDoc.id !== "string") {
    return NextResponse.json({ error: "Page not found" }, { status: 404 })
  }

  const currentValue = String(getNestedValue(pageDoc, version.fieldKey) ?? "")

  const updateData = buildNestedPatch(version.fieldKey, version.previousValue)
  const { error: payloadError, status: payloadStatus } = await updatePageInPayload(
    version.site,
    pageDoc.id,
    updateData
  )
  if (payloadError) return NextResponse.json({ error: payloadError }, { status: payloadStatus })

  await createVersionSnapshot({
    siteId: version.siteId,
    pageSlug: version.pageSlug,
    fieldKey: version.fieldKey,
    previousValue: currentValue,
    newValue: version.previousValue,
    changedBy: session.user.id,
    source: ChangeSource.MANUAL,
    maxVersions: getMaxVersions(subscription.tier),
  })

  await triggerRebuild(version.site.repoUrl ?? "", {
    source: "platform-revert",
    page: version.pageSlug,
    field: version.fieldKey,
    triggeredBy: session.user.id,
  })

  return NextResponse.json({ success: true, revertedTo: version.previousValue })
}
