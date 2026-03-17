export async function triggerRebuild(webhookUrl: string, payload: Record<string, unknown>): Promise<void> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET

  if (!webhookUrl || !secret) {
    console.error("[Rebuild] Missing webhook URL or GITHUB_WEBHOOK_SECRET")
    return
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      console.error(`[Rebuild] Webhook failed: ${response.status} ${text}`)
    }
  } catch (error) {
    console.error("[Rebuild] Webhook failed:", error)
  }
}
