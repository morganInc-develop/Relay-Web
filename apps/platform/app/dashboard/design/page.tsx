import { redirect } from "next/navigation"
import { RiLockLine } from "react-icons/ri"

import { auth } from "@/lib/auth"
import DesignTokensClient from "@/components/design/DesignTokensClient"
import PageHeader from "@/components/dashboard/PageHeader"
import AnimatedPage from "@/components/ui/AnimatedPage"
import { hasDesignAccess } from "@/lib/design-tier"
import { DEFAULT_FONT_PAIR_ID } from "@/lib/font-pairs"
import { prisma } from "@/lib/prisma"

const tokenDefinitions: Array<{
  key: string
  label: string
  type: "solid" | "gradient"
  defaultValue: string
}> = [
  { key: "color-primary", label: "Primary Color", type: "solid", defaultValue: "#6366f1" },
  { key: "color-accent", label: "Accent Color", type: "solid", defaultValue: "#8b5cf6" },
  { key: "color-background", label: "Background Color", type: "solid", defaultValue: "#0f0f0f" },
  { key: "color-text", label: "Text Color", type: "solid", defaultValue: "#ffffff" },
  {
    key: "gradient-hero",
    label: "Hero Gradient",
    type: "gradient",
    defaultValue: "linear-gradient(135deg, #6366f1, #8b5cf6)",
  },
  {
    key: "gradient-cta",
    label: "CTA Gradient",
    type: "gradient",
    defaultValue: "linear-gradient(135deg, #8b5cf6, #6366f1)",
  },
]

export default async function DesignPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true, stripePriceId: true },
  })

  if (subscription?.status !== "ACTIVE") redirect("/onboarding")

  if (!hasDesignAccess(subscription?.stripePriceId)) {
    return (
      <AnimatedPage className="rw-page-shell rw-page-shell--compact">
        <div className="rw-card border-dashed p-8 text-center">
          <RiLockLine className="mx-auto mb-4 h-10 w-10 text-[var(--text-muted)]" />
          <h1 className="mb-2 text-2xl font-bold text-[var(--text-primary)]">Design Controls Locked</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Upgrade to Tier 2 to unlock design controls.
          </p>
        </div>
      </AnimatedPage>
    )
  }

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, domain: true },
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

  return (
    <AnimatedPage className="rw-page-shell space-y-8">
      <PageHeader
        title="Design Tokens"
        description="Set brand colors, gradients, and typography, then preview the live surface before publishing."
      />
      <DesignTokensClient
        tokenMap={tokenMap}
        siteUrl={site.domain ? `https://${site.domain}` : null}
        tokenDefinitions={tokenDefinitions}
        defaultFontPairId={DEFAULT_FONT_PAIR_ID}
      />
    </AnimatedPage>
  )
}
