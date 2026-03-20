import Anthropic from "@anthropic-ai/sdk"
import { NextRequest, NextResponse } from "next/server"

import { analyzeComponent } from "@/lib/acorn-analysis"
import { auth } from "@/lib/auth"
import { hasTier3Access } from "@/lib/design-tier"
import { prisma } from "@/lib/prisma"
import { componentRateLimit } from "@/lib/rate-limit"

interface GenerateBody {
  description?: string
}

interface GeneratedComponentPayload {
  name?: unknown
  code?: unknown
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const systemPrompt = `You are a React component generator. Generate a single React functional component based on the user's description.
Rules:
- Use only React, TypeScript, and Tailwind CSS classes
- No network calls (no fetch, no XMLHttpRequest, no axios)
- No access to document, window, process, or globalThis
- No eval, no new Function(), no dynamic import()
- Export the component as the default export
- Define props with a TypeScript interface
- Keep the component self-contained and presentational
Return ONLY valid JSON in this exact shape, no other text:
{"name":"ComponentName","code":"full component source code as a single string"}`

export async function POST(req: NextRequest) {
  // 1. Auth
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Parse body
  let body: GenerateBody
  try {
    body = (await req.json()) as GenerateBody
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // 3. Validate description
  const description = typeof body.description === "string" ? body.description.trim() : ""
  if (description.length < 10 || description.length > 500) {
    return NextResponse.json({ error: "Description must be 10–500 characters" }, { status: 400 })
  }

  // 4. Site lookup
  const site = await prisma.site.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 })
  }

  // 5. Subscription lookup
  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { stripePriceId: true },
  })

  // 6. Tier gate
  if (!hasTier3Access(subscription?.stripePriceId)) {
    return NextResponse.json({ error: "Component generation requires Tier 3" }, { status: 403 })
  }

  // 7. Rate limit
  const rateLimitResult = await componentRateLimit.limit(`relayweb:component:${session.user.id}`)
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  // 8. Upsert ComponentLibrary
  const library = await prisma.componentLibrary.upsert({
    where: { siteId: site.id },
    update: {},
    create: { siteId: site.id },
  })

  // 9. Call Claude Haiku
  let generated: { name: string; code: string }
  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: description }],
    })

    const text = ("content" in message ? message.content : [])
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n")
      .trim()

    const parsed = JSON.parse(text) as GeneratedComponentPayload
    if (typeof parsed.name !== "string" || typeof parsed.code !== "string") {
      return NextResponse.json({ error: "Failed to generate component" }, { status: 500 })
    }

    generated = {
      name: parsed.name,
      code: parsed.code,
    }
  } catch {
    return NextResponse.json({ error: "Failed to generate component" }, { status: 500 })
  }

  // 10. Run Acorn analysis
  const analysis = analyzeComponent(generated.code)

  // 11. Save to DB
  const component = await prisma.component.create({
    data: {
      libraryId: library.id,
      name: generated.name,
      description,
      code: generated.code,
      approved: analysis.approved,
    },
  })

  // 12. Return
  return NextResponse.json({
    id: component.id,
    name: component.name,
    code: component.code,
    approved: component.approved,
    failReason: analysis.failReason ?? null,
  })
}
