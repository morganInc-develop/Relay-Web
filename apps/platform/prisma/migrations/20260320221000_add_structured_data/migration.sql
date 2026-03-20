-- CreateTable
CREATE TABLE "structured_data" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "pageSlug" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "structured_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "structured_data_siteId_pageSlug_key" ON "structured_data"("siteId", "pageSlug");

-- AddForeignKey
ALTER TABLE "structured_data" ADD CONSTRAINT "structured_data_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
