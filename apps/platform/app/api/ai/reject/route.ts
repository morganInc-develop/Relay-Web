import { AIActionType } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface RejectBody {
  logId?: string
}

interface ProposedAction {
  action?: string
  page?: string
  field?: string
  value?: string
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: RejectBody
  try {
    body = (await req.json()) as RejectBody
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!body.logId) {
    return NextResponse.json({ error: "logId is required" }, { status: 400 })
  }

  const chatLog = await prisma.aiChatLog.findUnique({
    where: { id: body.logId },
    select: {
      id: true,
      userId: true,
      siteId: true,
      status: true,
      message: true,
      proposedAction: true,
    },
  })

  if (!chatLog) {
    return NextResponse.json({ error: "Log not found" }, { status: 404 })
  }

  if (chatLog.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (chatLog.status !== "PENDING") {
    return NextResponse.json({ error: "Log already processed" }, { status: 409 })
  }

  let proposal: ProposedAction = {}
  try {
    proposal = chatLog.proposedAction ? (JSON.parse(chatLog.proposedAction) as ProposedAction) : {}
  } catch {
    proposal = {}
  }

  await prisma.aiChatLog.update({
    where: { id: chatLog.id },
    data: { status: "REJECTED" },
  })

  await prisma.aIAuditLog.create({
    data: {
      siteId: chatLog.siteId,
      userId: session.user.id,
      actionType: proposal.action === "update-seo" ? AIActionType.SEO_UPDATE : AIActionType.CONTENT_UPDATE,
      pageSlug: typeof proposal.page === "string" ? proposal.page : null,
      fieldKey: typeof proposal.field === "string" ? proposal.field : null,
      previousValue: null,
      newValue: typeof proposal.value === "string" ? proposal.value : null,
      userPrompt: chatLog.message,
      aiResponse: chatLog.proposedAction,
      wasApplied: false,
      wasRejected: true,
      prompt: chatLog.message,
      routeCalled: "/api/ai/reject",
      beforeValue: null,
      afterValue: null,
      success: false,
      errorMessage: "Rejected by user",
    },
  })

  return NextResponse.json({ success: true })
}
