import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkRateLimit, rateLimiters } from "@/lib/rate-limit"
import { getUserSubscription } from "@/lib/site-access"
import { PublishStatus, SubscriptionStatus } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

interface ScheduleBody {
  page?: string
  field?: string
  value?: string
  publishAt?: string
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rateLimit = await checkRateLimit(rateLimiters.contentUpdate, session.user.id)
  if (!rateLimit.success) return rateLimit.response!

  let body: ScheduleBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { page, field, value, publishAt } = body
  if (!page || !field || value === undefined || !publishAt) {
    return NextResponse.json(
      { error: "page, field, value, and publishAt are required" },
      { status: 400 }
    )
  }

  const publishDate = new Date(publishAt)
  if (Number.isNaN(publishDate.getTime())) {
    return NextResponse.json({ error: "Invalid publishAt date" }, { status: 400 })
  }
  if (publishDate <= new Date()) {
    return NextResponse.json({ error: "publishAt must be in the future" }, { status: 400 })
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

  const scheduled = await prisma.scheduledChange.create({
    data: {
      siteId: site.id,
      page,
      field,
      newValue: value,
      publishAt: publishDate,
      status: PublishStatus.SCHEDULED,
      createdBy: session.user.id,
    },
  })

  return NextResponse.json({
    success: true,
    id: scheduled.id,
    scheduledFor: scheduled.publishAt.toISOString(),
  })
}
