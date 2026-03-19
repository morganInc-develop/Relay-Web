import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import SeoAudit from "@/components/seo/SeoAudit"

export default async function SeoPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true, tier: true },
  })
  if (subscription?.status !== "ACTIVE") redirect("/onboarding")

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">SEO Audit</h1>
      <p className="text-gray-500 text-sm mb-8">
        Run an AI-powered audit on any page. Get scored results and one-click auto-fix.
      </p>
      <SeoAudit tier={subscription?.tier ?? "TIER1"} />
    </main>
  )
}
