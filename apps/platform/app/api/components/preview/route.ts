import { Sandbox } from "@e2b/code-interpreter"
import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { hasTier3Access } from "@/lib/design-tier"
import { prisma } from "@/lib/prisma"
import { previewRateLimit } from "@/lib/rate-limit"

interface PreviewBody {
  code?: string
}

interface SandboxPreviewResult {
  safe: boolean
  error?: string
}

export async function POST(req: NextRequest) {
  // 1. Auth
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Parse body
  let body: PreviewBody
  try {
    body = (await req.json()) as PreviewBody
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // 3. Validate code
  const code = typeof body.code === "string" ? body.code : ""
  if (code.length < 1 || code.length > 10000) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 })
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
    return NextResponse.json({ error: "Component preview requires Tier 3" }, { status: 403 })
  }

  // 7. Rate limit
  const rateLimitResult = await previewRateLimit.limit(`relayweb:preview:${session.user.id}`)
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  // 8. Run E2B sandbox
  let sandbox: Sandbox | null = null

  try {
    sandbox = await Sandbox.create({ apiKey: process.env.E2B_API_KEY })

    const script = `
      const code = ${JSON.stringify(code)};

      // Strip static imports (Node.js cannot process ES module imports natively)
      const stripped = code.replace(/^import\\s+.*?\\n/gm, '');

      // Replace JSX angle-bracket syntax with placeholder strings so that
      // Node.js can execute the non-JSX logic without a transpiler
      const sanitized = stripped
        .replace(/<[A-Z][a-zA-Z]*[^>]*\\/>/g, '"__jsx__"')
        .replace(/<[A-Z][a-zA-Z]*[^>]*>[\\s\\S]*?<\\/[A-Z][a-zA-Z]*>/g, '"__jsx__"')
        .replace(/<[a-z][^>]*\\/>/g, '"__jsx__"')
        .replace(/<[a-z][^>]*>[\\s\\S]*?<\\/[a-z]+>/g, '"__jsx__"');

      try {
        // Attempt to wrap in a Function to check for basic JS runtime errors
        new Function('React', sanitized);

        // Structural checks that Acorn does not enforce
        if (!code.includes('export default')) {
          throw new Error('Missing default export');
        }
        if (!/return\\s*[\\(<]/.test(code)) {
          throw new Error('Component does not appear to return JSX');
        }

        process.stdout.write(JSON.stringify({ safe: true }));
      } catch (e) {
        process.stdout.write(JSON.stringify({ safe: false, error: e instanceof Error ? e.message : 'Sandbox execution failed' }));
      }
    `

    const execution = await sandbox.runCode(script)
    const stdout = execution.logs.stdout.join("").trim()
    const stderr = execution.logs.stderr.join("").trim()

    if (execution.error) {
      return NextResponse.json({
        safe: false,
        error: execution.error.value ?? "Sandbox execution failed",
      })
    }

    if (!stdout) {
      return NextResponse.json({ safe: false, error: stderr || "Empty sandbox output" })
    }

    let result: SandboxPreviewResult
    try {
      result = JSON.parse(stdout) as SandboxPreviewResult
    } catch {
      return NextResponse.json({ safe: false, error: "Invalid sandbox output" })
    }

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ safe: false, error: "Sandbox execution failed" })
  } finally {
    if (sandbox) {
      await sandbox.kill()
    }
  }
}
