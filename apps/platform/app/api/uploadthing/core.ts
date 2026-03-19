import { randomUUID } from "crypto"
import { createUploadthing, type FileRouter } from "uploadthing/next"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { uploadToR2 } from "@/lib/r2"

const f = createUploadthing()

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

export const ourFileRouter = {
  imageUploader: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 1,
    },
  })
    .middleware(async ({ req }) => {
      const session = await auth()
      if (!session?.user?.id) {
        throw new Error("Unauthorized")
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
        throw new Error("Site not found")
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
      }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      try {
        const site = await prisma.site.findFirst({
          where: {
            id: metadata.siteId,
            ownerId: metadata.userId,
          },
          select: {
            id: true,
            r2Prefix: true,
          },
        })

        if (!site) {
          throw new Error("Site not found")
        }

        const resolvedPrefix = ensurePrefix(site.r2Prefix, site.id)
        if (!site.r2Prefix || site.r2Prefix !== resolvedPrefix) {
          await prisma.site.update({
            where: { id: site.id },
            data: { r2Prefix: resolvedPrefix },
          })
        }

        const uploadthingUrl = typeof file.url === "string" ? file.url : ""
        if (!uploadthingUrl) {
          throw new Error("Upload URL missing")
        }

        const uploadResponse = await fetch(uploadthingUrl)
        if (!uploadResponse.ok) {
          throw new Error("Failed to read optimized upload")
        }

        const buffer = Buffer.from(await uploadResponse.arrayBuffer())
        const contentType = uploadResponse.headers.get("content-type") ?? file.type ?? "image/webp"
        const fileName = sanitizeFileName(file.name)
        const r2Key = `${resolvedPrefix}/${Date.now()}-${randomUUID()}-${fileName}`

        await uploadToR2(r2Key, buffer, contentType)

        return {
          key: r2Key,
        }
      } catch (error) {
        console.error("[uploadthing:imageUploader] Failed to persist upload to R2", error)
        throw error
      }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
