import { auth } from "@/lib/auth"
import { getAllPagesFromPayload } from "@/lib/payload-client"
import { prisma } from "@/lib/prisma"
import { getUserSubscription } from "@/lib/site-access"
import { SubscriptionStatus } from "@prisma/client"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

  const { data, error, status } = await getAllPagesFromPayload(site)
  if (error) return NextResponse.json({ error }, { status })

  const docs = (data as { docs?: Array<Record<string, unknown>> } | null)?.docs ?? []
  const pages = docs
    .map((doc) => ({
      slug: typeof doc.slug === "string" ? doc.slug : "",
      title: typeof doc.title === "string" ? doc.title : "Untitled",
    }))
    .filter((page) => page.slug.length > 0)

  return NextResponse.json(pages)
}
