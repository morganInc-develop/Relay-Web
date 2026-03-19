import { redirect } from "next/navigation"

import AnalyticsDashboard from "@/components/analytics/AnalyticsDashboard"
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
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">Analytics</h1>
      <p className="mb-8 text-sm text-gray-500">
        Review performance metrics for your site without leaving your dashboard.
      </p>

      <AnalyticsDashboard />
    </main>
  )
}
