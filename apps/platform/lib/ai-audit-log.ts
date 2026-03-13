import { prisma } from "@/lib/prisma"
import { AIActionType } from "@prisma/client"

interface CreateAIAuditLogOptions {
  siteId: string
  userId: string
  actionType: AIActionType
  pageSlug: string
  fieldKey: string | null
  previousValue: string | null
  newValue: string | null
  userPrompt: string
  aiResponse: string
  wasApplied: boolean
  wasRejected: boolean
}

export async function createAIAuditLog(options: CreateAIAuditLogOptions) {
  return prisma.aIAuditLog.create({
    data: {
      siteId: options.siteId,
      actionType: options.actionType,
      prompt: JSON.stringify({
        userId: options.userId,
        pageSlug: options.pageSlug,
        fieldKey: options.fieldKey,
        userPrompt: options.userPrompt,
      }),
      routeCalled: "ai-chatbot",
      beforeValue: options.previousValue,
      afterValue: JSON.stringify({
        newValue: options.newValue,
        aiResponse: options.aiResponse,
        wasApplied: options.wasApplied,
        wasRejected: options.wasRejected,
      }),
      success: options.wasApplied && !options.wasRejected,
      errorMessage: options.wasRejected ? "Rejected by user or validation" : null,
    },
  })
}
