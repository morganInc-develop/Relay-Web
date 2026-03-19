-- CreateTable
CREATE TABLE "content_versions" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_versions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
