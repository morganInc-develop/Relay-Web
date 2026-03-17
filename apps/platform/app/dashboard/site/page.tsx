import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import DomainVerification from "@/components/domain/DomainVerification"
import SiteLinking from "@/components/site/SiteLinking"
import { CheckCircle } from "lucide-react"

export default async function SitePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  })
  if (!subscription || subscription.status !== "ACTIVE") redirect("/onboarding")

  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    select: {
      id: true,
      domain: true,
      name: true,
      domainVerified: true,
      verifiedAt: true,
      verifyToken: true,
      repoUrl: true,
      payloadUrl: true,
      vercelProjectId: true,
      r2Prefix: true,
      status: true,
    },
  })

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Your Site</h1>
        <p className="text-gray-500 mt-1">
          Connect your live website to RelayWeb to start editing content.
        </p>
      </div>

      {/* Step 1 — Domain Verification */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              site?.domainVerified
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {site?.domainVerified ? <CheckCircle className="w-5 h-5" /> : "1"}
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Verify your domain</h2>
            <p className="text-sm text-gray-500">
              Prove you own the domain by adding a meta tag to your site
            </p>
          </div>
        </div>

        {site?.domainVerified ? (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">
              {site.domain} verified on{" "}
              {site.verifiedAt
                ? new Date(site.verifiedAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : ""}
            </span>
          </div>
        ) : (
          <DomainVerification />
        )}
      </div>

      {/* Step 2 — Site Linking */}
      <div
        className={`bg-white border rounded-xl p-6 ${
          site?.domainVerified
            ? "border-gray-200"
            : "border-gray-100 opacity-50 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              site?.repoUrl && site?.payloadUrl
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {site?.repoUrl && site?.payloadUrl ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              "2"
            )}
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Link your site</h2>
            <p className="text-sm text-gray-500">
              Connect your GitHub repo, Payload CMS instance, and Neon database
            </p>
          </div>
        </div>

        {!site?.domainVerified ? (
          <p className="text-sm text-gray-400">
            Complete domain verification above to unlock this step.
          </p>
        ) : (
          <SiteLinking />
        )}
      </div>

      {/* Step 3 — Ready */}
      {site?.domainVerified && site?.repoUrl && site?.payloadUrl && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
          <h2 className="font-bold text-green-900 text-lg">Your site is connected</h2>
          <p className="text-green-700 text-sm mt-1 mb-4">
            You can now start editing content from the dashboard.
          </p>
          <a
            href="/dashboard"
            className="inline-block bg-gray-900 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
          >
            Go to dashboard →
          </a>
        </div>
      )}
    </div>
  )
}
