import { redirect } from "next/navigation"

import AIChatInterface from "@/components/ai/AIChatInterface"
import PageHeader from "@/components/dashboard/PageHeader"
import AnimatedPage from "@/components/ui/AnimatedPage"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export default async function AIPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true },
  })

  if (subscription?.status !== "ACTIVE") redirect("/onboarding")

  return (
    <AnimatedPage className="rw-page-shell rw-page-shell--narrow space-y-8">
      <PageHeader
        title="AI Assistant"
        description="Describe a content or SEO change in plain English, review the proposed update, and approve it before anything is applied."
      />
      <section className="rw-card p-6">
        <AIChatInterface />
      </section>
    </AnimatedPage>
  )
}
