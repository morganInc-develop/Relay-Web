import { redirect } from "next/navigation"

import ComponentSwapper from "@/components/design/ComponentSwapper"
import SectionReorder from "@/components/design/SectionReorder"
import {
  DEFAULT_SECTION_ORDER,
  VALID_SECTION_TYPES,
  getVariantsForSection,
} from "@/lib/component-variants"
import { auth } from "@/lib/auth"
import { hasDesignAccess } from "@/lib/design-tier"
import { prisma } from "@/lib/prisma"

export default async function LayoutPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true, stripePriceId: true },
  })

  if (subscription?.status !== "ACTIVE") redirect("/onboarding")

  if (!hasDesignAccess(subscription?.stripePriceId)) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-2xl font-bold text-slate-900">Layout Controls Locked</h1>
          <p className="text-sm text-slate-600">
            Upgrade to Tier 2 to unlock layout controls
          </p>
        </div>
      </main>
    )
  }

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })

  if (!site) redirect("/onboarding")

  const tokens = await prisma.designToken.findMany({
    where: { siteId: site.id },
    select: {
      key: true,
      value: true,
    },
  })

  const tokenMap: Record<string, string> = {}
  for (const token of tokens) {
    tokenMap[token.key] = token.value
  }

  const sectionTypes = Array.from(VALID_SECTION_TYPES)

  let parsedSectionOrder = [...DEFAULT_SECTION_ORDER]
  try {
    const parsed = JSON.parse(tokenMap["section-order"] ?? "null") as unknown
    if (!Array.isArray(parsed)) {
      throw new Error("Section order must be an array")
    }

    if (!parsed.every((item) => typeof item === "string" && VALID_SECTION_TYPES.has(item))) {
      throw new Error("Section order contains invalid section types")
    }

    if (new Set(parsed).size !== parsed.length) {
      throw new Error("Section order contains duplicates")
    }

    if (parsed.length !== VALID_SECTION_TYPES.size) {
      throw new Error("Section order is incomplete")
    }

    parsedSectionOrder = parsed
  } catch {
    parsedSectionOrder = [...DEFAULT_SECTION_ORDER]
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">Layout Controls</h1>
      <p className="mb-8 text-sm text-slate-500">
        Reorder sections and swap component variants. Changes trigger a site rebuild.
      </p>

      <section>
        <h2 className="text-xl font-bold text-slate-900">Section Order</h2>
        <p className="mt-2 text-sm text-slate-500">
          Drag to reorder. Changes trigger a site rebuild.
        </p>
        <div className="mt-6">
          <SectionReorder initialOrder={parsedSectionOrder} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-slate-900">Component Variants</h2>
        <p className="mt-2 text-sm text-slate-500">
          Choose a layout variant for each section.
        </p>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {sectionTypes.map((sectionType) => (
            <ComponentSwapper
              key={sectionType}
              sectionType={sectionType}
              sectionLabel={`${sectionType.charAt(0).toUpperCase() + sectionType.slice(1)} Section`}
              initialVariantId={
                tokenMap[`component-variant:${sectionType}`] ??
                getVariantsForSection(sectionType)[0]?.id ??
                ""
              }
            />
          ))}
        </div>
      </section>
    </main>
  )
}
