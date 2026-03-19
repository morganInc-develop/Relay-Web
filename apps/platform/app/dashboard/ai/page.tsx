import { redirect } from "next/navigation"

import AIChatInterface from "@/components/ai/AIChatInterface"
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
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">AI Assistant</h1>
      <p className="mb-8 text-sm text-gray-500">
        Ask for content and SEO edits in plain English, then confirm before applying.
      </p>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">AI Assistant</h2>
        <AIChatInterface />
      </section>
    </main>
  )
}
