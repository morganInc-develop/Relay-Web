interface TriggerClientRebuildOptions {
  siteRebuildUrl: string
  webhookSecret: string
  source?: string
  pageSlug?: string
  triggeredBy?: string
}

export async function triggerClientRebuild(
  options: TriggerClientRebuildOptions
): Promise<{ success: boolean; error?: string }> {
  const {
    siteRebuildUrl,
    webhookSecret,
    source = "platform-dashboard",
    pageSlug = "unknown",
    triggeredBy = "unknown",
  } = options

  try {
    const response = await fetch(`${siteRebuildUrl}/api/relayweb/rebuild`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${webhookSecret}`,
      },
      body: JSON.stringify({ source, pageSlug, triggeredBy }),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error ?? `Rebuild endpoint returned ${response.status}`)
    }

    await response.json()
    console.log(`[Platform] Client rebuild triggered | site: ${siteRebuildUrl} | page: ${pageSlug}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error(`[Platform] Failed to trigger client rebuild: ${message}`)
    return { success: false, error: message }
  }
}
