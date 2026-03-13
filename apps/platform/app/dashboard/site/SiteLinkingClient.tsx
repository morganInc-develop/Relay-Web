"use client"

import { useState } from "react"
import { Save } from "lucide-react"

interface Props {
  initialRepoUrl: string
  initialPayloadUrl: string
  initialVercelProjectId: string
}

export default function SiteLinkingClient({
  initialRepoUrl,
  initialPayloadUrl,
  initialVercelProjectId,
}: Props) {
  const [repoUrl, setRepoUrl] = useState(initialRepoUrl)
  const [payloadUrl, setPayloadUrl] = useState(initialPayloadUrl)
  const [vercelProjectId, setVercelProjectId] = useState(initialVercelProjectId)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSave = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch("/api/verify/link", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl, payloadUrl, vercelProjectId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to save")
      setSuccess(true)
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          GitHub repo URL
        </label>
        <input
          type="url"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/yourorg/client-site"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Payload CMS URL
        </label>
        <input
          type="url"
          value={payloadUrl}
          onChange={(e) => setPayloadUrl(e.target.value)}
          placeholder="https://client-site.vercel.app"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <p className="text-xs text-gray-400 mt-1">
          The base URL where your client site and Payload admin are deployed
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Vercel project ID{" "}
          <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={vercelProjectId}
          onChange={(e) => setVercelProjectId(e.target.value)}
          placeholder="prj_xxxxxxxxxxxx"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          Site linked successfully. Refreshing...
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={isLoading || (!repoUrl && !payloadUrl)}
        className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
      >
        <Save className="w-4 h-4" />
        {isLoading ? "Saving..." : "Save and link site"}
      </button>
    </div>
  )
}
