interface TriggerRebuildOptions {
  source?: string
  pageSlug?: string
  operation?: string
}

export async function triggerRebuild(options: TriggerRebuildOptions = {}): Promise<void> {
  const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL

  if (!deployHookUrl) {
    console.warn("[triggerRebuild] VERCEL_DEPLOY_HOOK_URL is not set — skipping rebuild")
    return
  }

  const { source = "payload", pageSlug = "unknown", operation = "unknown" } = options

  try {
    const response = await fetch(deployHookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })

    if (!response.ok) {
      throw new Error(`Deploy hook returned ${response.status}`)
    }

    console.log(
      `[triggerRebuild] Rebuild triggered | source: ${source} | page: ${pageSlug} | operation: ${operation}`
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error(`[triggerRebuild] Failed to trigger rebuild: ${message}`)
    // Do not throw — rebuild failures should not block content saves
  }
}
