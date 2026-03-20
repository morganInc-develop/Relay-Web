import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import CanvasPageSelector from "@/components/dashboard/CanvasPageSelector"
import ComponentGenerator from "@/components/dashboard/ComponentGenerator"
import type { CanvasItem } from "@/lib/canvas-registry"
import { hasTier3Access } from "@/lib/design-tier"
import { prisma } from "@/lib/prisma"

interface PayloadPagesResponse {
  docs?: Array<{
    slug?: string
    title?: string
  }>
}

export default async function ComponentsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true, stripePriceId: true },
  })

  if (subscription?.status !== "ACTIVE") redirect("/onboarding")

  if (!hasTier3Access(subscription?.stripePriceId)) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-2xl font-bold text-slate-900">Component Builder Locked</h1>
          <p className="text-sm text-slate-600">
            Upgrade to Tier 3 (Pro) to unlock the AI component builder
          </p>
        </div>
      </main>
    )
  }

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, domain: true, payloadUrl: true },
  })

  if (!site) redirect("/onboarding")

  const library = await prisma.componentLibrary.findUnique({
    where: { siteId: site.id },
    include: { components: { orderBy: { createdAt: "desc" } } },
  })

  const initialComponents = library?.components ?? []
  const canvasRecord = await prisma.canvasLayout.findUnique({
    where: { siteId_pageSlug: { siteId: site.id, pageSlug: "home" } },
  })
  const initialLayout = Array.isArray(canvasRecord?.layout)
    ? (canvasRecord.layout as unknown as CanvasItem[])
    : []
  let pages: Array<{ slug: string; title: string }> = [{ slug: "home", title: "Home" }]

  if (site.payloadUrl) {
    try {
      const response = await fetch(`${site.payloadUrl}/api/pages?limit=20`, {
        cache: "no-store",
      })

      if (response.ok) {
        const data = (await response.json()) as PayloadPagesResponse
        if (Array.isArray(data.docs) && data.docs.length > 0) {
          const nextPages = data.docs
            .filter((doc) => typeof doc.slug === "string")
            .map((doc) => ({
              slug: doc.slug as string,
              title: typeof doc.title === "string" ? doc.title : (doc.slug as string),
            }))

          if (nextPages.length > 0) {
            pages = nextPages
          }
        }
      }
    } catch {
      // Fall back to the default page list if Payload is unavailable.
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">Component Builder</h1>
      <p className="mb-8 text-sm text-slate-500">
        Describe a component in plain English. Claude generates the code, Acorn checks it for safety, and approved components are saved to your library.
      </p>
      <ComponentGenerator initialComponents={initialComponents} />
      <section className="mt-12">
        <h2 className="mb-2 text-xl font-bold text-slate-900">Page Canvas</h2>
        <p className="mb-6 text-sm text-slate-500">
          Drag blocks onto the canvas to build your page layout. Changes are saved per page.
        </p>
        <CanvasPageSelector
          initialPageSlug="home"
          initialLayout={initialLayout}
          initialPages={pages}
        />
      </section>
    </main>
  )
}
