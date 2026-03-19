import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getSignedImageUrl, normalizeR2Prefix } from "@/lib/r2"

function normalizeKey(key: string): string {
  return key.replace(/^\/+/, "")
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rawKey = req.nextUrl.searchParams.get("key")
  if (!rawKey) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 })
  }

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      r2Prefix: true,
    },
  })

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 })
  }

  const normalizedPrefix = normalizeR2Prefix(site.r2Prefix ?? `clients/${site.id}`)
  const normalizedKey = normalizeKey(rawKey)

  if (!normalizedKey.startsWith(`${normalizedPrefix}/`)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const url = await getSignedImageUrl(normalizedKey)
    return NextResponse.json({ url })
  } catch {
    return NextResponse.json({ error: "Failed to generate signed URL" }, { status: 500 })
  }
}
