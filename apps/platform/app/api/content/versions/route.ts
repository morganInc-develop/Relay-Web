import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface VersionEntry {
  id: string
  oldValue: string
  newValue: string
  createdAt: string
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      domainVerified: true,
      linked: true,
    },
  })

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 })
  }

  if (!site.domainVerified) {
    return NextResponse.json({ error: "Domain not verified" }, { status: 403 })
  }

  if (!site.linked) {
    return NextResponse.json({ error: "Site not linked" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const page = searchParams.get("page")?.trim() ?? ""
  const field = searchParams.get("field")?.trim() ?? ""

  if (!page) {
    return NextResponse.json({ error: "page is required" }, { status: 400 })
  }

  const records = await prisma.contentVersion.findMany({
    where: {
      siteId: site.id,
      page,
      ...(field ? { field } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      field: true,
      oldValue: true,
      newValue: true,
      createdAt: true,
    },
  })

  const versions: Record<string, VersionEntry[]> = {}
  for (const record of records) {
    const existing = versions[record.field] ?? []
    existing.push({
      id: record.id,
      oldValue: record.oldValue,
      newValue: record.newValue,
      createdAt: record.createdAt.toISOString(),
    })
    versions[record.field] = existing
  }

  return NextResponse.json({ versions })
}
