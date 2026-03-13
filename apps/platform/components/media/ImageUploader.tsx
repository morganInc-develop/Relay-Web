"use client"

import { useState } from "react"
import Image from "next/image"
import { generateReactHelpers } from "@uploadthing/react"
import { Upload, X, CheckCircle, AlertCircle } from "lucide-react"
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

  const { startUpload } = useUploadThing("siteImage", {
    headers: {
      "x-site-id": siteId,
    },
    onClientUploadComplete: (res: Array<{ url: string; name: string }> | undefined) => {
      if (res?.[0]) {
        setStatus("success")
        onUploadComplete(res[0].url, res[0].name)
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
    if (file.size > 10 * 1024 * 1024) {
      setStatus("error")
      setErrorMessage("File must be under 10MB")
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
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>

      {status === "idle" && (
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors">
          <Upload className="w-8 h-8 text-gray-400 mb-2" />
          <span className="text-sm text-gray-500">Click to upload or drag and drop</span>
          <span className="text-xs text-gray-400 mt-1">PNG, JPG, WebP, GIF up to 10MB</span>
          <input
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
            onChange={handleFileChange}
          />
        </label>
      )}

      {status === "uploading" && (
        <div className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl bg-gray-50">
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
            <div className="flex items-center gap-2 mb-1">
              <div className="w-4 h-4 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin" />
              <span className="text-sm text-gray-700">Uploading...</span>
            </div>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gray-900 rounded-full animate-pulse w-2/3" />
            </div>
          </div>
        </div>
      )}

      {status === "success" && (
        <div className="flex items-center gap-3 p-4 border border-green-200 rounded-xl bg-green-50">
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
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-700 font-medium">Upload complete</span>
            </div>
          </div>
          <button onClick={handleReset} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="flex items-center gap-3 p-4 border border-red-200 rounded-xl bg-red-50">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <span className="text-sm text-red-700">{errorMessage ?? "Upload failed"}</span>
          </div>
          <button onClick={handleReset} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
