import crypto from "crypto"

/**
 * Generates a unique verification token for a site
 * Format: relayweb-verify-{random hex}
 */
export function generateVerifyToken(): string {
  const random = crypto.randomBytes(24).toString("hex")
  return `relayweb-verify-${random}`
}

/**
 * Builds the meta tag string the client must embed in their site
 * This tag is what the platform pings to verify domain ownership
 */
export function buildVerifyMetaTag(token: string): string {
  return `<meta name="relayweb-verification" content="${token}" />`
}

/**
 * Pings a domain URL and checks for the verification meta tag
 * Returns true if the meta tag is found, false otherwise
 */
export async function checkDomainForMetaTag(
  domain: string,
  token: string
): Promise<{ verified: boolean; error?: string }> {
  // Normalize the domain — strip trailing slashes, ensure https
  const normalizedDomain = domain
    .replace(/\/$/, "")
    .replace(/^http:\/\//, "https://")

  const targetUrl = normalizedDomain.startsWith("https://")
    ? normalizedDomain
    : `https://${normalizedDomain}`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const response = await fetch(targetUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "RelayWeb-Verification/1.0",
        Accept: "text/html",
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return {
        verified: false,
        error: `Domain returned HTTP ${response.status}. Make sure your site is live and accessible.`,
      }
    }

    const html = await response.text()

    // Check for the meta tag in the HTML
    const metaTagPattern = new RegExp(
      `<meta[^>]*name=["']relayweb-verification["'][^>]*content=["']${token}["'][^>]*>`,
      "i"
    )
    const altMetaTagPattern = new RegExp(
      `<meta[^>]*content=["']${token}["'][^>]*name=["']relayweb-verification["'][^>]*>`,
      "i"
    )

    const found = metaTagPattern.test(html) || altMetaTagPattern.test(html)

    if (found) {
      return { verified: true }
    }

    return {
      verified: false,
      error:
        "Verification tag not found. Make sure you have added the meta tag to your site's <head> and redeployed.",
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        verified: false,
        error: "Domain check timed out after 10 seconds. Make sure your domain is accessible.",
      }
    }
    const message = err instanceof Error ? err.message : "Unknown error"
    return {
      verified: false,
      error: `Could not reach domain: ${message}`,
    }
  }
}

/**
 * Normalizes a domain string for storage
 * Strips protocol, www, trailing slashes
 */
export function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "")
    .trim()
}

/**
 * Checks if a verify token has expired (72 hours)
 */
export function isTokenExpired(createdAt: Date): boolean {
  const now = new Date()
  const expiryMs = 72 * 60 * 60 * 1000 // 72 hours in ms
  return now.getTime() - createdAt.getTime() > expiryMs
}
