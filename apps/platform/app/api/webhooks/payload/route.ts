import { prisma } from "@/lib/prisma"
import { triggerRebuild } from "@/lib/rebuild"
import { NextRequest, NextResponse } from "next/server"

interface PayloadWebhookBody {
  siteId?: string
  collection?: string
  operation?: string
}

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.PAYLOAD_WEBHOOK_SECRET
  const authHeader = req.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : ""

  if (!expectedSecret || token !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: PayloadWebhookBody
  try {
    body = (await req.json()) as PayloadWebhookBody
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { siteId, collection, operation } = body

  if (!siteId || !collection || !operation) {
    return NextResponse.json(
      { error: "siteId, collection, and operation are required" },
      { status: 400 }
    )
  }

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { repoUrl: true },
  })

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 })
  }

  await triggerRebuild(`${site.repoUrl ?? ""}/dispatches`, {
    source: "payload",
    collection,
    operation,
  })

  return NextResponse.json({ received: true })
}
