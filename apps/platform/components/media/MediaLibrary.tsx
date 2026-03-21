"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { type MediaAsset } from "@prisma/client"
import { generateUploadButton } from "@uploadthing/react"
import { motion } from "framer-motion"
import {
  RiDeleteBinLine,
  RiFileCopyLine,
  RiImageLine,
  RiLoader4Line,
  RiMovieLine,
  RiUploadCloud2Line,
  RiVideoUploadLine,
} from "react-icons/ri"
import { toast } from "sonner"

import { fadeUp, staggerContainer } from "@/lib/motion-variants"
import type { OurFileRouter } from "@/lib/uploadthing"

type MediaLibraryProps = {
  siteId: string
  initialAssets: MediaAsset[]
  canUploadVideo: boolean
}

const UploadButton = generateUploadButton<OurFileRouter>()

function formatFileSize(size: number) {
  return `${(size / 1024).toFixed(0)} KB`
}

async function readJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>
}

function MediaThumbnail({ asset }: { asset: MediaAsset }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(asset.mimeType.startsWith("image/"))
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (!asset.mimeType.startsWith("image/")) {
      setSignedUrl(null)
      setIsLoading(false)
      setHasError(false)
      return
    }

    const controller = new AbortController()
    let active = true

    async function loadPreview() {
      try {
        setIsLoading(true)
        setHasError(false)

        const response = await fetch(`/api/images/signed-url?key=${encodeURIComponent(asset.r2Key)}`, {
          cache: "no-store",
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error("Failed to load preview")
        }

        const data = await readJson<{ url?: string }>(response)
        if (active) {
          setSignedUrl(data.url ?? null)
        }
      } catch (error) {
        if (!controller.signal.aborted && active) {
          console.error("[MediaLibrary] Failed to load preview", error)
          setHasError(true)
          setSignedUrl(null)
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void loadPreview()

    return () => {
      active = false
      controller.abort()
    }
  }, [asset.mimeType, asset.r2Key])

  if (asset.mimeType.startsWith("video/")) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
        <div className="flex flex-col items-center gap-3 text-[var(--text-secondary)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-overlay)]">
            <RiMovieLine className="h-6 w-6 text-[var(--accent-500)]" />
          </div>
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Video asset
          </span>
        </div>
      </div>
    )
  }

  if (signedUrl) {
    return (
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
        <Image
          src={signedUrl}
          alt={asset.filename}
          fill
          unoptimized
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover"
        />
      </div>
    )
  }

  return (
    <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
      <div className="flex flex-col items-center gap-3 text-[var(--text-secondary)]">
        {isLoading ? (
          <RiLoader4Line className="h-6 w-6 animate-spin text-[var(--accent-500)]" />
        ) : (
          <RiImageLine className="h-6 w-6 text-[var(--text-muted)]" />
        )}
        <span className="text-xs text-[var(--text-muted)]">
          {hasError ? "Preview unavailable" : "Loading preview"}
        </span>
      </div>
    </div>
  )
}

export default function MediaLibrary({
  siteId,
  initialAssets,
  canUploadVideo,
}: MediaLibraryProps) {
  const [assets, setAssets] = useState(initialAssets)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const uploadToastId = useRef<string | number | null>(null)

  async function refreshAssets() {
    const response = await fetch(`/api/media/list?siteId=${encodeURIComponent(siteId)}`, {
      cache: "no-store",
    })

    if (!response.ok) {
      const data = await readJson<{ error?: string }>(response).catch(() => ({ error: undefined }))
      throw new Error(data.error ?? "Failed to refresh media library")
    }

    const nextAssets = await readJson<MediaAsset[]>(response)
    setAssets(nextAssets)
    return nextAssets
  }

  function startUpload(message: string) {
    setUploading(true)
    uploadToastId.current = toast.loading(message)
  }

  async function finishUpload(successMessage: string) {
    try {
      await refreshAssets()
      toast.success(successMessage, { id: uploadToastId.current ?? undefined })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to refresh media library", {
        id: uploadToastId.current ?? undefined,
      })
    } finally {
      setUploading(false)
      uploadToastId.current = null
    }
  }

  function failUpload(message: string) {
    toast.error(message, { id: uploadToastId.current ?? undefined })
    setUploading(false)
    uploadToastId.current = null
  }

  async function handleCopyUrl(asset: MediaAsset) {
    const toastId = toast.loading("Copying asset URL...")

    try {
      await navigator.clipboard.writeText(asset.url)
      toast.success("Copied", { id: toastId })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to copy URL", { id: toastId })
    }
  }

  async function handleDelete(asset: MediaAsset) {
    setDeleting(asset.id)
    const toastId = toast.loading("Deleting media...")

    try {
      const response = await fetch("/api/media/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          folder: "media",
          filename: asset.filename,
        }),
      })

      if (!response.ok) {
        const data = await readJson<{ error?: string }>(response).catch(() => ({ error: undefined }))
        throw new Error(data.error ?? "Failed to delete asset")
      }

      setAssets((currentAssets) => currentAssets.filter((currentAsset) => currentAsset.id !== asset.id))
      toast.success("Deleted", { id: toastId })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete asset", { id: toastId })
    } finally {
      setDeleting(null)
    }
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.section variants={fadeUp} className="rw-card space-y-5 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)]">
            <RiUploadCloud2Line className="h-6 w-6 text-[var(--accent-500)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Upload media</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Add branded images for every plan. Tier 3 can also store client-ready videos.
            </p>
          </div>
        </div>

        <div className={`grid gap-4 ${canUploadVideo ? "lg:grid-cols-2" : ""}`}>
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-overlay)]">
                <RiImageLine className="h-5 w-5 text-[var(--accent-500)]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Image uploads</p>
                <p className="text-xs text-[var(--text-secondary)]">JPEG, PNG, WebP, GIF, SVG up to 4MB</p>
              </div>
            </div>

            <UploadButton
              endpoint="imageUploader"
              headers={() => ({ "x-site-id": siteId })}
              disabled={uploading}
              onUploadBegin={() => startUpload("Uploading image...")}
              onClientUploadComplete={async () => {
                await finishUpload("Image uploaded.")
              }}
              onUploadError={(error) => {
                failUpload(error.message ?? "Image upload failed")
              }}
              onUploadAborted={() => {
                failUpload("Image upload canceled")
              }}
              appearance={{
                container: "w-full items-stretch",
                button:
                  "rw-btn rw-btn-primary h-11 w-full justify-center rounded-xl border-0 px-4 text-sm font-medium",
                allowedContent: "mt-3 text-xs text-[var(--text-muted)]",
              }}
              content={{
                button({ isUploading }) {
                  return isUploading ? "Uploading..." : "Upload image"
                },
                allowedContent() {
                  return "Stored in your site media library after UploadThing processing."
                },
              }}
            />
          </div>

          {canUploadVideo ? (
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-overlay)]">
                  <RiVideoUploadLine className="h-5 w-5 text-[var(--accent-500)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Video uploads</p>
                  <p className="text-xs text-[var(--text-secondary)]">MP4 and other video formats up to 64MB</p>
                </div>
              </div>

              <UploadButton
                endpoint="videoUploader"
                headers={() => ({ "x-site-id": siteId })}
                disabled={uploading}
                onUploadBegin={() => startUpload("Uploading video...")}
                onClientUploadComplete={async () => {
                  await finishUpload("Video uploaded.")
                }}
                onUploadError={(error) => {
                  failUpload(error.message ?? "Video upload failed")
                }}
                onUploadAborted={() => {
                  failUpload("Video upload canceled")
                }}
                appearance={{
                  container: "w-full items-stretch",
                  button:
                    "rw-btn rw-btn-secondary h-11 w-full justify-center rounded-xl px-4 text-sm font-medium",
                  allowedContent: "mt-3 text-xs text-[var(--text-muted)]",
                }}
                content={{
                  button({ isUploading }) {
                    return isUploading ? "Uploading..." : "Upload video"
                  },
                  allowedContent() {
                    return "Tier 3 uploads are stored alongside your image library."
                  },
                }}
              />
            </div>
          ) : null}
        </div>
      </motion.section>

      <motion.section variants={fadeUp} className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Asset grid</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Manage uploaded images and videos, copy stored asset URLs, and remove files from R2.
            </p>
          </div>
          <div className="rw-pill">{assets.length} assets</div>
        </div>

        {assets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)] p-6 text-sm text-[var(--text-secondary)]">
            No media uploaded yet.
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
          >
            {assets.map((asset) => {
              const isDeleting = deleting === asset.id

              return (
                <motion.article key={asset.id} variants={fadeUp} className="rw-card p-2">
                  <MediaThumbnail asset={asset} />

                  <div className="space-y-3 p-2">
                    <div>
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]" title={asset.filename}>
                        {asset.filename}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {formatFileSize(asset.size)}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCopyUrl(asset)}
                        className="rw-btn rw-btn-secondary h-9 justify-center px-3 text-xs"
                      >
                        <RiFileCopyLine className="h-4 w-4" />
                        Copy URL
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(asset)}
                        disabled={isDeleting}
                        className="rw-btn rw-btn-secondary h-9 justify-center px-3 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isDeleting ? (
                          <RiLoader4Line className="h-4 w-4 animate-spin" />
                        ) : (
                          <RiDeleteBinLine className="h-4 w-4" />
                        )}
                        Delete
                      </button>
                    </div>
                  </div>
                </motion.article>
              )
            })}
          </motion.div>
        )}
      </motion.section>
    </motion.div>
  )
}
