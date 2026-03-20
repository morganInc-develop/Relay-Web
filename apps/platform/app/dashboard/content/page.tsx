import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

import AnimatedPage from "@/components/ui/AnimatedPage"
import PageHeader from "@/components/dashboard/PageHeader"
import ContentEditor from "./ContentEditor"

export default async function ContentPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true },
  })

  if (subscription?.status !== "ACTIVE") redirect("/onboarding")

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })

  if (!site) redirect("/onboarding")

  return (
    <AnimatedPage className="rw-page-shell rw-page-shell--narrow space-y-8">
      <PageHeader
        title="Content Editor"
        description="Edit page copy and SEO fields, schedule changes, and restore prior versions without leaving the dashboard."
      />
      <section className="rw-card p-6">
        <ContentEditor siteId={site.id} />
      </section>
    </AnimatedPage>
  )
}
