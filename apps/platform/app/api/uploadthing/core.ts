import { randomUUID } from "crypto"
import { createUploadthing, type FileRouter } from "uploadthing/next"
import { UploadThingError } from "uploadthing/server"
import { SubscriptionStatus } from "@prisma/client"

import { auth } from "@/lib/auth"
import { hasTier3Access } from "@/lib/design-tier"
import { prisma } from "@/lib/prisma"
import { checkRateLimit, mediaUploadRateLimit } from "@/lib/rate-limit"
import { uploadToR2 } from "@/lib/r2"

const f = createUploadthing()

type UploadMetadata = {
  userId: string
  siteId: string
  resolvedPrefix: string
}

function sanitizeFileName(fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
  return safeName.length > 0 ? safeName : "upload"
}

function ensurePrefix(prefix: string | null | undefined, siteId: string): string {
  if (!prefix || !prefix.trim()) {
    return `clients/${siteId}`
  }

  return prefix
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .trim()
}

function createForbiddenError(message: string) {
  return new UploadThingError({
    code: "FORBIDDEN",
    message,
  })
}

async function resolveUploadMetadata(req: Request, requireTier3 = false): Promise<UploadMetadata> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new UploadThingError({
      code: "FORBIDDEN",
      message: "Unauthorized",
    })
  }

  const rateLimit = await checkRateLimit(mediaUploadRateLimit, session.user.id)
  if (!rateLimit.success) {
    throw createForbiddenError("Rate limit exceeded. Please slow down and try again.")
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: {
      status: true,
      stripePriceId: true,
    },
  })

  if (subscription?.status !== SubscriptionStatus.ACTIVE) {
    throw createForbiddenError("Active subscription required")
  }

  if (requireTier3 && !hasTier3Access(subscription.stripePriceId)) {
    throw createForbiddenError("Tier 3 required for video uploads")
  }

  const requestedSiteId = req.headers.get("x-site-id")

  const site = await prisma.site.findFirst({
    where: {
      ownerId: session.user.id,
      ...(requestedSiteId ? { id: requestedSiteId } : {}),
    },
    select: {
      id: true,
      r2Prefix: true,
    },
    orderBy: { createdAt: "desc" },
  })

  if (!site) {
    throw new UploadThingError({
      code: "NOT_FOUND",
      message: "Site not found",
    })
  }

  const resolvedPrefix = ensurePrefix(site.r2Prefix, site.id)
  if (!site.r2Prefix || site.r2Prefix !== resolvedPrefix) {
    await prisma.site.update({
      where: { id: site.id },
      data: { r2Prefix: resolvedPrefix },
    })
  }

  return {
    userId: session.user.id,
    siteId: site.id,
    resolvedPrefix,
  }
}

async function persistUploadToR2(
  metadata: UploadMetadata,
  file: {
    name: string
    url: string
    type?: string
  },
  fallbackContentType: string
) {
  const uploadthingUrl = typeof file.url === "string" ? file.url : ""
  if (!uploadthingUrl) {
    throw new Error("Upload URL missing")
  }

  const uploadResponse = await fetch(uploadthingUrl)
  if (!uploadResponse.ok) {
    throw new Error("Failed to read optimized upload")
  }

  const buffer = Buffer.from(await uploadResponse.arrayBuffer())
  const contentType = uploadResponse.headers.get("content-type") ?? file.type ?? fallbackContentType
  const fileName = `${Date.now()}-${randomUUID()}-${sanitizeFileName(file.name)}`
  const r2Key = `${metadata.resolvedPrefix}/media/${fileName}`

  await uploadToR2(r2Key, buffer, contentType)
  await prisma.mediaAsset.create({
    data: {
      siteId: metadata.siteId,
      r2Key,
      filename: fileName,
      mimeType: contentType,
      size: buffer.length,
      url: r2Key,
    },
  })

  return {
    key: r2Key,
  }
}

export const ourFileRouter = {
  imageUploader: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 1,
    },
  })
    .middleware(async ({ req }) => resolveUploadMetadata(req))
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        return await persistUploadToR2(metadata, file, "image/webp")
      } catch (error) {
        console.error("[uploadthing:imageUploader] Failed to persist upload to R2", error)
        throw error
      }
    }),
  videoUploader: f({
    video: {
      maxFileSize: "64MB",
      maxFileCount: 1,
    },
  })
    .middleware(async ({ req }) => resolveUploadMetadata(req, true))
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        return await persistUploadToR2(metadata, file, "video/mp4")
      } catch (error) {
        console.error("[uploadthing:videoUploader] Failed to persist upload to R2", error)
        throw error
      }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
