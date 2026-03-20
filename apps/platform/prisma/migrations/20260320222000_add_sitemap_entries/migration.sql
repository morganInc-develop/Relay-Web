-- CreateTable
CREATE TABLE "sitemap_entries" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "pageSlug" TEXT NOT NULL,
    "include" BOOLEAN NOT NULL DEFAULT true,
    "priority" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "changefreq" TEXT NOT NULL DEFAULT 'weekly',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sitemap_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sitemap_entries_siteId_pageSlug_key" ON "sitemap_entries"("siteId", "pageSlug");

-- AddForeignKey
ALTER TABLE "sitemap_entries" ADD CONSTRAINT "sitemap_entries_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
