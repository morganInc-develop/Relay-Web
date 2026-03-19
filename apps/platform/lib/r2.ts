import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME
const DEFAULT_URL_EXPIRY_SECONDS = 3600

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  throw new Error("Missing required R2 environment variables")
}

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})

export function normalizeR2Prefix(prefix: string): string {
  return prefix.replace(/^\/+/, "").replace(/\/+$/, "")
}

export function buildSiteScopedKey(prefix: string, filename: string): string {
  const safePrefix = normalizeR2Prefix(prefix)
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
  return `${safePrefix}/${safeFilename}`
}

export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  })

  await r2Client.send(command)
}

export async function getSignedImageUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  })

  return getSignedUrl(r2Client, command, { expiresIn: DEFAULT_URL_EXPIRY_SECONDS })
}

export async function deleteFromR2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  })

  await r2Client.send(command)
}

// Compatibility helpers for existing media routes.
export async function getUploadSignedUrl(
  key: string,
  contentType: string,
  expiresInSeconds = DEFAULT_URL_EXPIRY_SECONDS
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  })

  return getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds })
}

export async function getReadSignedUrl(
  key: string,
  expiresInSeconds = DEFAULT_URL_EXPIRY_SECONDS
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  })

  return getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds })
}

export function buildR2Key(siteId: string, folder: string, filename: string): string {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
  return `clients/${siteId}/${folder}/${safeFilename}`
}

export function isAllowedImageType(contentType: string): boolean {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]
  return allowed.includes(contentType)
}

export function isAllowedFileSize(sizeInBytes: number): boolean {
  const maxSize = 4 * 1024 * 1024
  return sizeInBytes <= maxSize
}
