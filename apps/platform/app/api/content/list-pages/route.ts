import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

interface PayloadPagesResponse {
  docs?: Array<{
    id?: string
    slug?: string
    title?: string
  }>
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      payloadUrl: true,
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

  if (!site.payloadUrl) {
    return NextResponse.json({ error: "Payload fetch failed" }, { status: 502 })
  }

  try {
    const response = await fetch(`${site.payloadUrl}/api/pages`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    })

    if (!response.ok) {
      return NextResponse.json({ error: "Payload fetch failed" }, { status: 502 })
    }

    const data = (await response.json()) as PayloadPagesResponse
    const pages = (data.docs ?? [])
      .map((doc) => ({
        id: typeof doc.id === "string" ? doc.id : "",
        slug: typeof doc.slug === "string" ? doc.slug : "",
        title: typeof doc.title === "string" ? doc.title : "Untitled",
      }))
      .filter((page) => page.id.length > 0 && page.slug.length > 0)

    return NextResponse.json({ pages })
  } catch {
    return NextResponse.json({ error: "Payload fetch failed" }, { status: 502 })
  }
}
