import { sendEmail } from "@/lib/email"
import { scheduledPublishEmail } from "@/lib/email-templates"
import { prisma } from "@/lib/prisma"
import { triggerRebuild } from "@/lib/rebuild"
import { getVersionLimit } from "@/lib/version-limit"
import { NextRequest, NextResponse } from "next/server"

type SeoField = "metaTitle" | "metaDescription" | "ogTitle" | "ogDescription" | "ogImage"

interface PayloadPageResponse {
  docs?: Array<Record<string, unknown>>
}

const seoFields: SeoField[] = [
  "metaTitle",
  "metaDescription",
  "ogTitle",
  "ogDescription",
  "ogImage",
]

function isSeoField(field: string): field is SeoField {
  return seoFields.includes(field as SeoField)
}

function getSeoPath(field: SeoField): string[] {
  switch (field) {
    case "metaTitle":
      return ["meta", "title"]
    case "metaDescription":
      return ["meta", "description"]
    case "ogTitle":
      return ["openGraph", "title"]
    case "ogDescription":
      return ["openGraph", "description"]
    case "ogImage":
      return ["openGraph", "url"]
  }
}

function buildNestedPatch(path: string[], value: string): Record<string, unknown> {
  const root: Record<string, unknown> = {}
  let cursor = root

  path.forEach((segment, index) => {
    if (index === path.length - 1) {
      cursor[segment] = value
      return
    }

    const next: Record<string, unknown> = {}
    cursor[segment] = next
    cursor = next
  })

  return root
}

function getNestedValue(value: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = value

  for (const segment of path) {
    if (!current || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[segment]
  }

  return current
}

export async function GET(req: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : ""

  if (!expectedSecret || token !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dueChanges = await prisma.scheduledChange.findMany({
    where: {
      status: "SCHEDULED",
      publishAt: { lte: new Date() },
    },
    include: {
      site: {
        select: {
          id: true,
          repoUrl: true,
          payloadUrl: true,
          ownerId: true,
        },
      },
    },
    orderBy: { publishAt: "asc" },
  })

  let successCount = 0
  let failCount = 0

  for (const record of dueChanges) {
    try {
      if (!record.site.payloadUrl) {
        throw new Error("Missing payloadUrl")
      }

      const pageResponse = await fetch(
        `${record.site.payloadUrl}/api/pages?where[slug][equals]=${encodeURIComponent(record.page)}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        }
      )

      if (!pageResponse.ok) {
        throw new Error(`Failed to fetch page (${pageResponse.status})`)
      }

      const pageData = (await pageResponse.json()) as PayloadPageResponse
      const pageDoc = pageData.docs?.[0]

      if (!pageDoc || typeof pageDoc.id !== "string") {
        throw new Error("Page not found")
      }

      const oldValue = isSeoField(record.field)
        ? String(getNestedValue(pageDoc, getSeoPath(record.field)) ?? "")
        : String(pageDoc[record.field] ?? "")

      const patchPayload = isSeoField(record.field)
        ? buildNestedPatch(getSeoPath(record.field), record.value)
        : { [record.field]: record.value }

      const patchResponse = await fetch(`${record.site.payloadUrl}/api/pages/${pageDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchPayload),
      })

      if (!patchResponse.ok) {
        throw new Error(`Failed to patch page (${patchResponse.status})`)
      }

      const subscription = await prisma.subscription.findUnique({
        where: { userId: record.site.ownerId },
        select: { stripePriceId: true },
      })
      const limit = getVersionLimit(subscription?.stripePriceId)

      const count = await prisma.contentVersion.count({
        where: {
          siteId: record.site.id,
          page: record.page,
          field: record.field,
        },
      })

      if (count >= limit) {
        const oldest = await prisma.contentVersion.findFirst({
          where: {
            siteId: record.site.id,
            page: record.page,
            field: record.field,
          },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        })

        if (oldest) {
          await prisma.contentVersion.deleteMany({
            where: { id: oldest.id },
          })
        }
      }

      await prisma.contentVersion.create({
        data: {
          siteId: record.site.id,
          page: record.page,
          field: record.field,
          oldValue,
          newValue: record.value,
        },
      })

      await triggerRebuild(`${record.site.repoUrl ?? ""}/dispatches`, {
        source: "cron",
        page: record.page,
        field: record.field,
      })

      const owner = await prisma.user.findUnique({
        where: { id: record.site.ownerId },
        select: { email: true, name: true },
      })

      if (owner?.email) {
        await sendEmail({
          to: owner.email,
          subject: `Your scheduled update to ${record.field} on ${record.page} is now live`,
          html: scheduledPublishEmail(owner.name ?? "there", record.field, record.page),
        })
      }

      await prisma.scheduledChange.update({
        where: { id: record.id },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      })

      successCount += 1
    } catch (error) {
      console.error(`[cron] Failed to publish scheduled change ${record.id}:`, error)
      failCount += 1

      try {
        await prisma.scheduledChange.update({
          where: { id: record.id },
          data: { status: "DISCARDED" },
        })
      } catch (updateError) {
        console.error(`[cron] Failed to mark scheduled change ${record.id} as discarded:`, updateError)
      }
    }
  }

  if (failCount > 0) {
    console.error(`[cron] Published ${successCount}, discarded ${failCount}`)
  }

  return NextResponse.json({ published: successCount })
}
