import crypto from "crypto"
import { resolveTxt } from "dns/promises"

/**
 * Generates a unique verification token for a site
 * Format: relayweb-verify-{random hex}
 */
export function generateVerifyToken(): string {
  const random = crypto.randomBytes(24).toString("hex")
  return `relayweb-verify-${random}`
}

export function buildVerifyTxtRecord(domain: string, token: string): { name: string; value: string } {
  return {
    name: `_relayweb-verify.${normalizeDomain(domain)}`,
    value: token,
  }
}

export async function checkDomainForTxtRecord(
  domain: string,
  token: string
): Promise<{ verified: boolean; error?: string }> {
  const normalizedDomain = normalizeDomain(domain)
  const txtHosts = [`_relayweb-verify.${normalizedDomain}`, normalizedDomain]

  for (const host of txtHosts) {
    try {
      const records = await resolveTxt(host)
      const flattenedRecords = records.map((chunks) => chunks.join(""))

      if (flattenedRecords.some((value) => value.trim() === token)) {
        return { verified: true }
      }
    } catch (error) {
      const dnsError = error as NodeJS.ErrnoException
      if (!["ENODATA", "ENOTFOUND", "ESERVFAIL"].includes(dnsError.code ?? "")) {
        return {
          verified: false,
          error: `Could not read TXT records for ${host}: ${dnsError.message}`,
        }
      }
    }
  }

  return {
    verified: false,
    error:
      "Verification TXT record not found yet. Add the TXT record in your DNS provider and try again after DNS propagates.",
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
