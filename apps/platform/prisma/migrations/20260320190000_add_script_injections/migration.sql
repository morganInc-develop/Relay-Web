-- CreateTable
CREATE TABLE "script_injections" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "src" TEXT,
    "content" TEXT,
    "placement" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_injections_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "script_injections" ADD CONSTRAINT "script_injections_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
