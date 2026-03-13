import { Site } from "@prisma/client"

interface PayloadFetchOptions {
  site: Site
  path: string
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  body?: Record<string, unknown>
}

interface PayloadResponse<T = unknown> {
  data: T | null
  error: string | null
  status: number
}

export async function payloadFetch<T = unknown>({
  site,
  path,
  method = "GET",
  body,
}: PayloadFetchOptions): Promise<PayloadResponse<T>> {
  if (!site.payloadUrl) {
    return { data: null, error: "Site has no Payload URL configured", status: 400 }
  }

  const url = `${site.payloadUrl}/api${path}`

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        // Payload API key authentication will be added in a later step
        // For now the Payload instance is accessed directly
      },
      body: body ? JSON.stringify(body) : undefined,
      // Timeout after 10 seconds
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error")
      return { data: null, error: `Payload API error: ${errorText}`, status: response.status }
    }

    const data = await response.json() as T
    return { data, error: null, status: response.status }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return { data: null, error: `Failed to reach client site: ${message}`, status: 500 }
  }
}

export async function getPageFromPayload(site: Site, slug: string) {
  return payloadFetch({
    site,
    path: `/pages?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`,
  })
}

export async function getAllPagesFromPayload(site: Site) {
  return payloadFetch({
    site,
    path: "/pages?limit=100&sort=title",
  })
}

export async function updatePageInPayload(
  site: Site,
  pageId: string,
  data: Record<string, unknown>
) {
  return payloadFetch({
    site,
    path: `/pages/${pageId}`,
    method: "PATCH",
    body: data,
  })
}
