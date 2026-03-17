import { auth } from "@/lib/auth"
import { sendEmail } from "@/lib/email"
import { getPageFromPayload, updatePageInPayload } from "@/lib/payload-client"
import { prisma } from "@/lib/prisma"
import { checkRateLimit, rateLimiters } from "@/lib/rate-limit"
import { triggerRebuild } from "@/lib/rebuild"
import { getUserSubscription } from "@/lib/site-access"
import { createVersionSnapshot, getMaxVersions } from "@/lib/version-snapshot"
import { ChangeSource, SubscriptionStatus } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

interface UpdateTextBody {
  page: string
  field: string
  value: string
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

  let body: UpdateTextBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { page, field, value } = body
  if (!page || !field || value === undefined) {
    return NextResponse.json({ error: "page, field, and value are required" }, { status: 400 })
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

  const { data: pageData, error: pageError, status: pageStatus } = await getPageFromPayload(site, page)
  if (pageError) return NextResponse.json({ error: pageError }, { status: pageStatus })

  const pageDoc = (pageData as { docs?: Array<Record<string, unknown>> } | null)?.docs?.[0]
  if (!pageDoc || typeof pageDoc.id !== "string") {
    return NextResponse.json({ error: "Page not found" }, { status: 404 })
  }

  const oldValue = String(getNestedValue(pageDoc, field) ?? "")
  const maxVersions = getMaxVersions(subscription.tier)

  await createVersionSnapshot({
    siteId: site.id,
    pageSlug: page,
    fieldKey: field,
    previousValue: oldValue,
    newValue: value,
    changedBy: session.user.id,
    source: ChangeSource.MANUAL,
    maxVersions,
  })

  const updateData = buildNestedPatch(field, value)
  const { error: payloadError, status: payloadStatus } = await updatePageInPayload(
    site,
    pageDoc.id,
    updateData
  )
  if (payloadError) {
    return NextResponse.json({ error: payloadError }, { status: payloadStatus })
  }

  await triggerRebuild(site.repoUrl ?? "", {
    source: "platform-text-update",
    page,
    field,
    triggeredBy: session.user.id,
  })

  const versionCount = await prisma.versionSnapshot.count({
    where: {
      siteId: site.id,
      pageSlug: page,
      fieldKey: field,
    },
  })

  const agencyEmail = "hello@morgandev.studio"
  try {
    await sendEmail({
      to: agencyEmail,
      subject: `Client updated ${field} on ${page}`,
      html: `<p>Client ${session.user.id} updated <strong>${field}</strong> on <strong>${page}</strong>.</p>`,
    })
  } catch (error) {
    console.error("[Content] Agency notification email failed:", error)
  }

  return NextResponse.json({
    success: true,
    versionsRemaining: Math.max(maxVersions - versionCount, 0),
  })
}
