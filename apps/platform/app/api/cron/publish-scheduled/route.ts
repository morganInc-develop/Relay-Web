import { scheduledPublishEmail } from "@/lib/email-templates"
import { sendEmail } from "@/lib/email"
import { getPageFromPayload, updatePageInPayload } from "@/lib/payload-client"
import { prisma } from "@/lib/prisma"
import { triggerRebuild } from "@/lib/rebuild"
import { PublishStatus } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

function buildNestedPatch(path: string, value: string): Record<string, unknown> {
  const keys = path.split(".")
  const root: Record<string, unknown> = {}
  let current: Record<string, unknown> = root

  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      current[key] = value
      return
    }

    const next: Record<string, unknown> = {}
    current[key] = next
    current = next
  })

  return root
}

export async function GET(req: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization")

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dueChanges = await prisma.scheduledChange.findMany({
    where: {
      status: PublishStatus.SCHEDULED,
      publishAt: { lte: new Date() },
    },
    include: {
      site: true,
    },
    orderBy: {
      publishAt: "asc",
    },
  })

  let published = 0

  for (const scheduledChange of dueChanges) {
    try {
      const { data: pageData, error: pageError } = await getPageFromPayload(
        scheduledChange.site,
        scheduledChange.page
      )

      if (pageError) {
        console.error(`[Cron] Failed to load page ${scheduledChange.page}:`, pageError)
        continue
      }

      const pageDoc = (pageData as { docs?: Array<Record<string, unknown>> } | null)?.docs?.[0]
      if (!pageDoc || typeof pageDoc.id !== "string") {
        console.error(`[Cron] Page not found for scheduled change ${scheduledChange.id}`)
        continue
      }

      const updateData = buildNestedPatch(scheduledChange.field, scheduledChange.newValue)
      const { error: updateError } = await updatePageInPayload(
        scheduledChange.site,
        pageDoc.id,
        updateData
      )

      if (updateError) {
        console.error(`[Cron] Failed to apply scheduled change ${scheduledChange.id}:`, updateError)
        continue
      }

      await triggerRebuild(scheduledChange.site.repoUrl ?? "", {
        source: "platform-scheduled-publish",
        page: scheduledChange.page,
        field: scheduledChange.field,
        scheduledChangeId: scheduledChange.id,
      })

      const owner = await prisma.user.findUnique({
        where: { id: scheduledChange.site.ownerId },
        select: { email: true, name: true },
      })

      if (owner?.email) {
        try {
          await sendEmail({
            to: owner.email,
            subject: `Your scheduled update to ${scheduledChange.field} on ${scheduledChange.page} is now live`,
            html: scheduledPublishEmail(
              owner.name ?? "there",
              scheduledChange.field,
              scheduledChange.page
            ),
          })
        } catch (error) {
          console.error("[Cron] Scheduled publish email failed:", error)
        }
      }

      await prisma.scheduledChange.update({
        where: { id: scheduledChange.id },
        data: {
          status: PublishStatus.PUBLISHED,
          publishedAt: new Date(),
        },
      })

      published += 1
    } catch (error) {
      console.error(`[Cron] Failed to publish scheduled change ${scheduledChange.id}:`, error)
    }
  }

  return NextResponse.json({ published })
}
