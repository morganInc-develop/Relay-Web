import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import {
  getSiteForUser,
  getUserSubscription,
  tierAllows,
  tierNotAllowedResponse,
} from "@/lib/site-access"
import { updatePageInPayload } from "@/lib/payload-client"
import { createVersionSnapshot, getMaxVersions } from "@/lib/version-snapshot"
import { triggerClientRebuild } from "@/lib/triggerClientRebuild"
import { ChangeSource, SubscriptionStatus, SubscriptionTier } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { checkRateLimit, rateLimiters } from "@/lib/rate-limit"

interface RevertBody {
  siteId: string
  pageId: string
  snapshotId: string
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

export async function PATCH(req: NextRequest) {
  // 1. Auth check
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Parse body
  let body: RevertBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { siteId, pageId, snapshotId } = body
  if (!siteId || !pageId || !snapshotId) {
    return NextResponse.json({ error: "siteId, pageId, and snapshotId are required" }, { status: 400 })
  }

  // 2. Site ownership check
  const { site, response: accessError } = await getSiteForUser(siteId, session.user.id)
  if (accessError) return accessError
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 })

  // 3. Tier check
  const subscription = await getUserSubscription(session.user.id)
  if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
    return NextResponse.json({ error: "Active subscription required" }, { status: 403 })
  }
  if (!tierAllows(subscription.tier, SubscriptionTier.TIER1)) {
    return tierNotAllowedResponse("version rollback")
  }

  // 4. Rate limit check
  const rateLimit = await checkRateLimit(rateLimiters.contentUpdate, session.user.id)
  if (!rateLimit.success) return rateLimit.response!

  // Fetch the snapshot
  const snapshot = await prisma.versionSnapshot.findUnique({
    where: { id: snapshotId },
  })

  if (!snapshot || snapshot.siteId !== siteId) {
    return NextResponse.json({ error: "Snapshot not found" }, { status: 404 })
  }

  // Save a new snapshot recording the revert action
  await createVersionSnapshot({
    siteId,
    pageSlug: snapshot.pageSlug,
    fieldKey: snapshot.fieldKey,
    previousValue: snapshot.newValue,
    newValue: snapshot.previousValue,
    changedBy: session.user.id,
    source: ChangeSource.MANUAL,
    maxVersions: getMaxVersions(subscription.tier),
  })

  // Apply the reverted value to Payload
  const updateData = buildNestedPatch(snapshot.fieldKey, snapshot.previousValue)
  const { error: payloadError, status: payloadStatus } = await updatePageInPayload(
    site,
    pageId,
    updateData
  )
  if (payloadError) {
    return NextResponse.json({ error: payloadError }, { status: payloadStatus })
  }

  // Trigger rebuild
  if (site.payloadUrl) {
    await triggerClientRebuild({
      siteRebuildUrl: site.payloadUrl,
      webhookSecret: process.env.RELAYWEB_CLIENT_WEBHOOK_SECRET ?? "",
      source: "platform-revert",
      pageSlug: snapshot.pageSlug,
      triggeredBy: session.user.id,
    })
  }

  return NextResponse.json({
    success: true,
    revertedField: snapshot.fieldKey,
    revertedTo: snapshot.previousValue,
  })
}
