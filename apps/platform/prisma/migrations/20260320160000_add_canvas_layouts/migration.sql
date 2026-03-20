-- CreateTable
CREATE TABLE "canvas_layouts" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "pageSlug" TEXT NOT NULL,
    "layout" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canvas_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "canvas_layouts_siteId_pageSlug_key" ON "canvas_layouts"("siteId", "pageSlug");

-- AddForeignKey
ALTER TABLE "canvas_layouts" ADD CONSTRAINT "canvas_layouts_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
