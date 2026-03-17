import { prisma } from "@/lib/prisma"
import { triggerRebuild } from "@/lib/rebuild"
import { NextRequest, NextResponse } from "next/server"

interface PayloadWebhookBody {
  siteId?: string
  collection?: string
  operation?: string
}

export async function POST(req: NextRequest) {
  const secret = process.env.PAYLOAD_WEBHOOK_SECRET
  const authHeader = req.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader

  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: PayloadWebhookBody
  try {
    body = await req.json()
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

  const site = await prisma.site.findUnique({ where: { id: siteId } })
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 })

  await triggerRebuild(site.repoUrl ?? "", {
    source: "payload",
    siteId,
    collection,
    operation,
  })

  return NextResponse.json({ received: true })
}
