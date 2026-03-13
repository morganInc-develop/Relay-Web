import { NextRequest, NextResponse } from "next/server"

interface RebuildRequestBody {
  source?: string
  pageSlug?: string
  triggeredBy?: string
}

export async function POST(req: NextRequest) {
  const timestamp = new Date().toISOString()

  // Step 1 — Verify authorization
  const authHeader = req.headers.get("authorization")
  const expectedSecret = process.env.RELAYWEB_WEBHOOK_SECRET

  if (!expectedSecret) {
    console.error(`[RelayWeb Rebuild] ${timestamp} — RELAYWEB_WEBHOOK_SECRET is not configured`)
    return NextResponse.json(
      { error: "Server misconfigured — missing webhook secret" },
      { status: 500 }
    )
  }

  if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
    console.warn(`[RelayWeb Rebuild] ${timestamp} — Unauthorized rebuild attempt`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Step 2 — Parse optional body for logging
  let body: RebuildRequestBody = {}
  try {
    body = await req.json()
  } catch {
    // Body is optional — ignore parse errors
  }

  const source = body.source ?? "unknown"
  const pageSlug = body.pageSlug ?? "all"
  const triggeredBy = body.triggeredBy ?? "unknown"

  console.log(
    `[RelayWeb Rebuild] ${timestamp} — Rebuild requested | source: ${source} | page: ${pageSlug} | triggeredBy: ${triggeredBy}`
  )

  // Step 3 — Trigger Vercel deploy hook
  const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL

  if (!deployHookUrl) {
    console.error(`[RelayWeb Rebuild] ${timestamp} — VERCEL_DEPLOY_HOOK_URL is not configured`)
    return NextResponse.json(
      { error: "No deploy hook configured" },
      { status: 500 }
    )
  }

  try {
    const response = await fetch(deployHookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })

    if (!response.ok) {
      throw new Error(`Vercel deploy hook returned status ${response.status}`)
    }

    console.log(
      `[RelayWeb Rebuild] ${timestamp} — Rebuild triggered successfully | source: ${source}`
    )

    return NextResponse.json({
      success: true,
      message: "Rebuild triggered",
      timestamp,
      source,
      pageSlug,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error(`[RelayWeb Rebuild] ${timestamp} — Failed to trigger rebuild: ${message}`)
    return NextResponse.json(
      { error: "Failed to trigger Vercel rebuild", detail: message },
      { status: 500 }
    )
  }
}
