import { auth } from "@/lib/auth"
import { applySeoFieldUpdate, ContentMutationError } from "@/lib/content-mutations"
import { sendEmail } from "@/lib/email"
import { contentUpdatedEmail } from "@/lib/email-templates"
import { prisma } from "@/lib/prisma"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { NextRequest, NextResponse } from "next/server"

interface UpdateSeoBody {
  page?: string
  field?: string
  value?: string
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const contentRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 h"),
})

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: UpdateSeoBody
  try {
    body = (await req.json()) as UpdateSeoBody
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { page, field, value } = body
  if (!page || !field || typeof value !== "string") {
    return NextResponse.json({ error: "page, field, and value are required" }, { status: 400 })
  }

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      payloadUrl: true,
      repoUrl: true,
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

  const rateLimitResult = await contentRateLimit.limit(`relayweb:content:${session.user.id}`)
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { stripePriceId: true },
  })

  try {
    const result = await applySeoFieldUpdate({
      site,
      page,
      field,
      value,
      stripePriceId: subscription?.stripePriceId,
    })

    await sendEmail({
      to: process.env.AGENCY_EMAIL!,
      subject: "Client updated SEO",
      html: contentUpdatedEmail("Agency", field, page),
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ContentMutationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: "Payload fetch failed" }, { status: 502 })
  }
}
