-- DropIndex
DROP INDEX "design_tokens_siteId_key";

-- AlterTable
ALTER TABLE "design_tokens" DROP COLUMN "colors",
DROP COLUMN "fonts",
ADD COLUMN     "key" TEXT NOT NULL,
ADD COLUMN     "value" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "design_tokens_siteId_key_key" ON "design_tokens"("siteId", "key");
