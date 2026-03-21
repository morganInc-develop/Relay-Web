import { redirect } from "next/navigation"
import { RiLockLine } from "react-icons/ri"

import PageHeader from "@/components/dashboard/PageHeader"
import MediaLibrary from "@/components/media/MediaLibrary"
import AnimatedPage from "@/components/ui/AnimatedPage"
import { auth } from "@/lib/auth"
import { hasTier3Access } from "@/lib/design-tier"
import { prisma } from "@/lib/prisma"

export default async function MediaPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: {
      status: true,
      stripePriceId: true,
    },
  })

  if (subscription?.status !== "ACTIVE") redirect("/onboarding")

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })

  if (!site) {
    return (
      <AnimatedPage className="rw-page-shell rw-page-shell--compact">
        <div className="rw-card border-dashed p-8 text-center">
          <RiLockLine className="mx-auto mb-4 h-10 w-10 text-[var(--text-muted)]" />
          <h1 className="mb-2 text-2xl font-bold text-[var(--text-primary)]">Media Library</h1>
          <p className="text-sm text-[var(--text-secondary)]">Connect your site first.</p>
        </div>
      </AnimatedPage>
    )
  }

  const assets = await prisma.mediaAsset.findMany({
    where: { siteId: site.id },
    orderBy: { createdAt: "desc" },
  })

  const canUploadVideo = hasTier3Access(subscription?.stripePriceId)

  return (
    <AnimatedPage className="rw-page-shell rw-page-shell--compact">
      <PageHeader
        title="Media Library"
        description="Upload and manage images and videos for your site."
      />
      <MediaLibrary
        siteId={site.id}
        initialAssets={assets}
        canUploadVideo={canUploadVideo}
      />
    </AnimatedPage>
  )
}
