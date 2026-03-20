import { redirect } from "next/navigation"

import AnalyticsDashboard from "@/components/analytics/AnalyticsDashboard"
import PageHeader from "@/components/dashboard/PageHeader"
import AnimatedPage from "@/components/ui/AnimatedPage"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export default async function AnalyticsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true },
  })

  if (subscription?.status !== "ACTIVE") redirect("/onboarding")

  return (
    <AnimatedPage className="rw-page-shell space-y-8">
      <PageHeader
        title="Analytics"
        description="Review traffic, top pages, acquisition, and device mix in a single summary view."
      />
      <AnalyticsDashboard />
    </AnimatedPage>
  )
}
