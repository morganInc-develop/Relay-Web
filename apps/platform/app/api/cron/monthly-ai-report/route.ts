import { SubscriptionTier } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

import { sendEmail } from "@/lib/email"
import { monthlyAiSiteReportEmail } from "@/lib/email-templates"
import { prisma } from "@/lib/prisma"

function getPreviousMonthRange() {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0))
  const monthLabel = start.toISOString().slice(0, 7)
  return { start, end, monthLabel }
}

export async function GET(req: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : ""

  if (!expectedSecret || token !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { start, end, monthLabel } = getPreviousMonthRange()

  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      tier: SubscriptionTier.TIER3,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  })

  let sent = 0

  for (const subscription of subscriptions) {
    try {
      if (!subscription.user.email) continue

      const site = await prisma.site.findFirst({
        where: { ownerId: subscription.user.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, domain: true },
      })

      if (!site) continue

      const [contentChanges, seoScans, aiActions, seoAvg] = await Promise.all([
        prisma.contentVersion.count({
          where: {
            siteId: site.id,
            createdAt: { gte: start, lt: end },
          },
        }),
        prisma.seoScan.count({
          where: {
            siteId: site.id,
            createdAt: { gte: start, lt: end },
          },
        }),
        prisma.aIAuditLog.count({
          where: {
            siteId: site.id,
            createdAt: { gte: start, lt: end },
            wasApplied: true,
          },
        }),
        prisma.sEOAudit.aggregate({
          where: {
            siteId: site.id,
            createdAt: { gte: start, lt: end },
          },
          _avg: { score: true },
        }),
      ])

      await sendEmail({
        to: subscription.user.email,
        subject: `Monthly AI site report — ${monthLabel}`,
        html: monthlyAiSiteReportEmail({
          domain: site.domain ?? "unknown-domain",
          month: monthLabel,
          contentChanges,
          seoScans,
          aiActions,
          avgSeoScore: typeof seoAvg._avg.score === "number" ? Number(seoAvg._avg.score.toFixed(1)) : null,
        }),
      })

      sent += 1
    } catch (error) {
      console.error("[cron/monthly-ai-report] failed for subscription", subscription.id, error)
    }
  }

  return NextResponse.json({ sent })
}
