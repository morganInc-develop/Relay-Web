import { createUploadthing, type FileRouter } from "uploadthing/next"
import { auth } from "@/lib/auth"
import { getSiteForUser, getUserSubscription } from "@/lib/site-access"
import { checkRateLimit, rateLimiters } from "@/lib/rate-limit"
import { SubscriptionStatus } from "@prisma/client"

const f = createUploadthing()

export const ourFileRouter = {
  // Image uploader for client site media
  siteImage: f({
    image: {
      maxFileSize: "10MB" as unknown as "16MB",
      maxFileCount: 1,
    },
  })
    .middleware(async ({ req }) => {
      // 1. Auth check
      const session = await auth()
      if (!session?.user?.id) throw new Error("Unauthorized")

      // 2. Rate limit check
      const rateLimit = await checkRateLimit(
        rateLimiters.imageUpload,
        session.user.id
      )
      if (!rateLimit.success) throw new Error("Rate limit exceeded")

      // 3. Get siteId from headers
      const siteId = req.headers.get("x-site-id")
      if (!siteId) throw new Error("siteId is required")

      // 4. Site ownership check
      const { site, response: accessError } = await getSiteForUser(siteId, session.user.id)
      if (accessError || !site) throw new Error("Site not found or access denied")

      // 5. Subscription check
      const subscription = await getUserSubscription(session.user.id)
      if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
        throw new Error("Active subscription required")
      }

      return { userId: session.user.id, siteId }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log(
        `[Uploadthing] Upload complete | user: ${metadata.userId} | site: ${metadata.siteId} | file: ${file.name}`
      )
      return { siteId: metadata.siteId, fileUrl: file.url, fileName: file.name }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
