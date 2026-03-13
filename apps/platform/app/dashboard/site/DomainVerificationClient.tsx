"use client"

import { useState } from "react"
import { Copy, Check, RefreshCw, Globe } from "lucide-react"

interface Props {
  initialDomain: string
  initialToken: string
  initialMetaTag: string
}

export default function DomainVerificationClient({
  initialDomain,
  initialToken,
  initialMetaTag,
}: Props) {
  const [domain, setDomain] = useState(initialDomain)
  const [siteName, setSiteName] = useState("")
  const [metaTag, setMetaTag] = useState(initialMetaTag)
  const [step, setStep] = useState<"input" | "tag" | "verifying">(
    initialToken ? "tag" : "input"
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (!domain.trim()) {
      setError("Please enter your domain")
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/verify/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", domain, name: siteName || domain }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to generate token")
      setMetaTag(data.metaTag)
      setStep("tag")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify = async () => {
    setIsLoading(true)
    setError(null)
    setStep("verifying")
    try {
      const res = await fetch("/api/verify/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Verification failed")
      if (data.verified) {
        window.location.reload()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setStep("tag")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(metaTag)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (step === "input") {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Site name
          </label>
          <input
            type="text"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="My Business Website"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Domain <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="yourdomain.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <p className="text-xs text-gray-400 mt-1">
            Enter your domain without http:// or www
          </p>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {isLoading ? "Generating..." : "Generate verification tag"}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm font-medium text-gray-700 mb-2">
          Add this tag inside the{" "}
          <code className="bg-gray-200 px-1 rounded text-xs">&lt;head&gt;</code>{" "}
          of your site layout:
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-white border border-gray-200 rounded px-3 py-2 break-all font-mono text-gray-700">
            {metaTag}
          </code>
          <button
            onClick={handleCopy}
            className="flex-shrink-0 p-2 text-gray-500 hover:text-gray-900 transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
        <li>Copy the meta tag above</li>
        <li>
          Paste it into your site&apos;s{" "}
          <code className="bg-gray-100 px-1 rounded text-xs">
            app/layout.tsx
          </code>{" "}
          inside the{" "}
          <code className="bg-gray-100 px-1 rounded text-xs">&lt;head&gt;</code>
        </li>
        <li>Redeploy your site on Vercel</li>
        <li>Click Verify below</li>
      </ol>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleVerify}
          disabled={isLoading}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <Globe className="w-4 h-4" />
              Verify domain
            </>
          )}
        </button>
        <button
          onClick={() => setStep("input")}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Use a different domain
        </button>
      </div>
    </div>
  )
}
