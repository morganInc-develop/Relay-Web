"use client"

import { useState } from "react"
import Image from "next/image"
import { generateReactHelpers } from "@uploadthing/react"
import {
  RiCheckboxCircleLine,
  RiCloseLine,
  RiErrorWarningLine,
  RiUploadCloud2Line,
} from "react-icons/ri"
import type { OurFileRouter } from "@/lib/uploadthing"

interface ImageUploaderProps {
  siteId: string
  onUploadComplete: (fileUrl: string, fileName: string) => void
  onUploadError?: (error: string) => void
  label?: string
  accept?: string
}

type UploadStatus = "idle" | "uploading" | "success" | "error"

const { useUploadThing } = generateReactHelpers<OurFileRouter>()

export default function ImageUploader({
  siteId,
  onUploadComplete,
  onUploadError,
  label = "Upload image",
}: ImageUploaderProps) {
  const [status, setStatus] = useState<UploadStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const { startUpload } = useUploadThing("imageUploader", {
    headers: {
      "x-site-id": siteId,
    },
    onClientUploadComplete: (res: Array<{ serverData?: { key?: string }; name: string }> | undefined) => {
      if (res?.[0]) {
        setStatus("success")
        onUploadComplete(res[0].serverData?.key ?? "", res[0].name)
      }
    },
    onUploadError: (error: Error) => {
      setStatus("error")
      const message = error.message ?? "Upload failed"
      setErrorMessage(message)
      onUploadError?.(message)
    },
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Client-side validation
    if (file.size > 4 * 1024 * 1024) {
      setStatus("error")
      setErrorMessage("File must be under 4MB")
      return
    }

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]
    if (!allowed.includes(file.type)) {
      setStatus("error")
      setErrorMessage("Only JPEG, PNG, WebP, GIF, and SVG files are allowed")
      return
    }

    // Show preview
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)

    setStatus("uploading")
    setErrorMessage(null)
    startUpload([file])
  }

  function handleReset() {
    setStatus("idle")
    setErrorMessage(null)
    setPreview(null)
  }

  return (
    <div className="w-full">
      <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">{label}</label>

      {status === "idle" && (
        <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)] transition-colors hover:border-[var(--border-accent)] hover:bg-[var(--bg-overlay)]">
          <RiUploadCloud2Line className="mb-2 h-8 w-8 text-[var(--text-muted)]" />
          <span className="text-sm text-[var(--text-secondary)]">Click to upload or drag and drop</span>
          <span className="mt-1 text-xs text-[var(--text-muted)]">PNG, JPG, WebP, GIF up to 4MB</span>
          <input
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
            onChange={handleFileChange}
          />
        </label>
      )}

      {status === "uploading" && (
        <div className="rw-card flex items-center gap-3 bg-[var(--bg-elevated)] p-4">
          {preview && (
            <Image
              src={preview}
              alt="Preview"
              width={48}
              height={48}
              unoptimized
              className="w-12 h-12 object-cover rounded-lg"
            />
          )}
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-500)]" />
              <span className="text-sm text-[var(--text-secondary)]">Uploading...</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-overlay)]">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-[var(--accent-500)]" />
            </div>
          </div>
        </div>
      )}

      {status === "success" && (
        <div className="flex items-center gap-3 rounded-xl border border-[color:rgba(34,197,94,0.25)] bg-[var(--success-bg)] p-4">
          {preview && (
            <Image
              src={preview}
              alt="Uploaded"
              width={48}
              height={48}
              unoptimized
              className="w-12 h-12 object-cover rounded-lg"
            />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <RiCheckboxCircleLine className="h-4 w-4 text-[var(--success)]" />
              <span className="text-sm font-medium text-[var(--success)]">Upload complete</span>
            </div>
          </div>
          <button onClick={handleReset} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <RiCloseLine className="h-4 w-4" />
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="flex items-center gap-3 rounded-xl border border-[color:rgba(239,68,68,0.25)] bg-[var(--error-bg)] p-4">
          <RiErrorWarningLine className="h-5 w-5 shrink-0 text-[var(--error)]" />
          <div className="flex-1">
            <span className="text-sm text-[var(--error)]">{errorMessage ?? "Upload failed"}</span>
          </div>
          <button onClick={handleReset} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <RiCloseLine className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
