import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { SubscriptionStatus } from "@prisma/client"
import ContentEditor from "./ContentEditor"

export default async function ContentPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  })

  if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
    redirect("/onboarding")
  }

  // Get the user's newest site
  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
  })

  if (!site) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Content Editor</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <p className="text-amber-800 font-medium mb-2">No site connected yet</p>
          <p className="text-amber-600 text-sm">
            Connect your client site to start editing content.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Content Editor</h1>
        <p className="text-gray-500 text-sm mt-1">
          Edit your website content. Changes are saved automatically and your site rebuilds within 60 seconds.
        </p>
      </div>
      <ContentEditor
        siteId={site.id}
      />
    </div>
  )
}
