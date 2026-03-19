export async function triggerRebuild(webhookUrl: string, payload: object): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GITHUB_WEBHOOK_SECRET}`,
      },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error("[rebuild] Webhook failed:", err)
  }
}
