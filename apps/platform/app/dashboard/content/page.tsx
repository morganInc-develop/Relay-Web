import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
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
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">Content Editor</h1>
      <p className="text-gray-500 text-sm mb-8">
        Select a page and edit your site content. Each field saves independently.
      </p>

      <section>
        <ContentEditor siteId={site.id} />
      </section>
    </main>
  )
}
