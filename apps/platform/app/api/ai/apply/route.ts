import { AIActionType } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import {
  applySeoFieldUpdate,
  applyTextFieldUpdate,
  ContentMutationError,
} from "@/lib/content-mutations"
import { sendEmail } from "@/lib/email"
import { aiChangeEmail } from "@/lib/email-templates"
import { prisma } from "@/lib/prisma"

interface ApplyBody {
  logId?: string
}

interface ProposedAction {
  action?: string
  page?: string
  field?: string
  value?: string
  reasoning?: string
}

const VALID_ACTIONS = new Set(["update-text", "update-seo"])

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: ApplyBody
  try {
    body = (await req.json()) as ApplyBody
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!body.logId) {
    return NextResponse.json({ error: "logId is required" }, { status: 400 })
  }

  const chatLog = await prisma.aiChatLog.findUnique({
    where: { id: body.logId },
    include: {
      site: {
        select: {
          id: true,
          ownerId: true,
          payloadUrl: true,
          repoUrl: true,
          domainVerified: true,
          linked: true,
        },
      },
    },
  })

  if (!chatLog) {
    return NextResponse.json({ error: "Log not found" }, { status: 404 })
  }

  if (chatLog.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (chatLog.status !== "PENDING") {
    return NextResponse.json({ error: "Log already processed" }, { status: 400 })
  }

  let proposal: ProposedAction
  try {
    proposal = chatLog.proposedAction ? (JSON.parse(chatLog.proposedAction) as ProposedAction) : {}
  } catch {
    return NextResponse.json({ error: "Invalid proposed action" }, { status: 400 })
  }

  const action = typeof proposal.action === "string" ? proposal.action : ""
  const page = typeof proposal.page === "string" ? proposal.page.trim() : ""
  const field = typeof proposal.field === "string" ? proposal.field.trim() : ""
  const value = typeof proposal.value === "string" ? proposal.value : ""

  if (!VALID_ACTIONS.has(action)) {
    return NextResponse.json({ error: "Invalid proposed action" }, { status: 400 })
  }

  if (!page || !field || !value) {
    return NextResponse.json({ error: "Invalid proposed action" }, { status: 400 })
  }

  if (!chatLog.site.domainVerified || !chatLog.site.linked) {
    return NextResponse.json({ error: "Site must be verified and linked first" }, { status: 403 })
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true, stripePriceId: true },
  })

  if (!subscription || subscription.status !== "ACTIVE") {
    return NextResponse.json({ error: "Active subscription required" }, { status: 403 })
  }

  let fieldBefore = ""
  try {
    if (action === "update-seo") {
      const result = await applySeoFieldUpdate({
        site: chatLog.site,
        page,
        field,
        value,
        stripePriceId: subscription.stripePriceId,
      })
      fieldBefore = result.oldValue
    } else {
      const result = await applyTextFieldUpdate({
        site: chatLog.site,
        page,
        field,
        value,
        stripePriceId: subscription.stripePriceId,
      })
      fieldBefore = result.oldValue
    }
  } catch (error) {
    const status = error instanceof ContentMutationError ? error.status : 500
    const message = error instanceof ContentMutationError ? error.message : "Failed to apply action"

    await prisma.aiChatLog.update({
      where: { id: chatLog.id },
      data: { status: "FAILED" },
    })

    return NextResponse.json({ error: message }, { status })
  }

  await prisma.aiChatLog.update({
    where: { id: chatLog.id },
    data: {
      status: "APPLIED",
      fieldBefore,
      fieldAfter: value,
    },
  })

  await prisma.aIAuditLog.create({
    data: {
      siteId: chatLog.site.id,
      userId: session.user.id,
      actionType: action === "update-seo" ? AIActionType.SEO_UPDATE : AIActionType.CONTENT_UPDATE,
      pageSlug: page,
      fieldKey: field,
      previousValue: fieldBefore,
      newValue: value,
      userPrompt: chatLog.message,
      aiResponse: chatLog.proposedAction,
      wasApplied: true,
      wasRejected: false,
      prompt: chatLog.message,
      routeCalled: "/api/ai/apply",
      beforeValue: fieldBefore,
      afterValue: value,
      success: true,
      errorMessage: null,
    },
  })

  const agencyOwner = await prisma.user.findUnique({
    where: { id: chatLog.site.ownerId },
    select: { email: true },
  })

  const recipient = process.env.AGENCY_EMAIL ?? agencyOwner?.email
  if (recipient) {
    await sendEmail({
      to: recipient,
      subject: `AI made a change — ${field} on ${page}`,
      html: aiChangeEmail(field, page, fieldBefore, value),
    })
  }

  return NextResponse.json({ success: true, fieldAfter: value })
}
