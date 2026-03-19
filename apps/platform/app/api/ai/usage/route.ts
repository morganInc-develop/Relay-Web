import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { getAiLimits } from "@/lib/ai-limits"
import { prisma } from "@/lib/prisma"

function getDateParts() {
  const now = new Date()
  const day = now.toISOString().slice(0, 10)
  const month = day.slice(0, 7)
  return { day, month }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true, stripePriceId: true },
  })

  if (!subscription || subscription.status !== "ACTIVE") {
    return NextResponse.json({ error: "Active subscription required" }, { status: 403 })
  }

  const { day, month } = getDateParts()
  const [todayUsage, monthUsage] = await Promise.all([
    prisma.aiUsage.findUnique({
      where: {
        userId_date: {
          userId: session.user.id,
          date: day,
        },
      },
      select: { dailyCount: true },
    }),
    prisma.aiUsage.findFirst({
      where: {
        userId: session.user.id,
        month,
      },
      orderBy: { updatedAt: "desc" },
      select: { monthlyCount: true },
    }),
  ])

  const dailyUsed = todayUsage?.dailyCount ?? 0
  const monthlyUsed = monthUsage?.monthlyCount ?? 0
  const limits = getAiLimits(subscription.stripePriceId ?? "")

  const dailyRemaining = limits.dailyCap === null ? null : Math.max(limits.dailyCap - dailyUsed, 0)
  const monthlyRemaining =
    limits.monthlyCap === null ? null : Math.max(limits.monthlyCap - monthlyUsed, 0)

  return NextResponse.json({
    dailyUsed,
    dailyLimit: limits.dailyCap,
    monthlyUsed,
    monthlyLimit: limits.monthlyCap,
    dailyRemaining,
    monthlyRemaining,
    dailyCap: limits.dailyCap,
    monthlyCap: limits.monthlyCap,
  })
}
