import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!

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

// Generate a signed URL for uploading a file to R2
// Expires in 1 hour
export async function getUploadSignedUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds })
}

// Generate a signed URL for reading a file from R2
// Expires in 1 hour by default
export async function getReadSignedUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  })
  return getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds })
}

// Delete a file from R2
export async function deleteFromR2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  })
  await r2Client.send(command)
}

// Build the R2 key for a client file
// Format: clients/{siteId}/{folder}/{filename}
export function buildR2Key(siteId: string, folder: string, filename: string): string {
  // Sanitize filename — remove any path traversal attempts
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
  return `clients/${siteId}/${folder}/${safeFilename}`
}

// Validate file type is an allowed image type
export function isAllowedImageType(contentType: string): boolean {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]
  return allowed.includes(contentType)
}

// Validate file size — max 10MB
export function isAllowedFileSize(sizeInBytes: number): boolean {
  const MAX_SIZE = 10 * 1024 * 1024 // 10MB
  return sizeInBytes <= MAX_SIZE
}
