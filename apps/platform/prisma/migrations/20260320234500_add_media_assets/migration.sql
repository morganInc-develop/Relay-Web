-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
