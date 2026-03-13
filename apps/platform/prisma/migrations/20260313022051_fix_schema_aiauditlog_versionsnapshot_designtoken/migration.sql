/*
  Warnings:

  - Added the required column `fieldKey` to the `version_snapshots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pageSlug` to the `version_snapshots` table without a default value. This is not possible if the table is not empty.
  - Made the column `changedBy` on table `version_snapshots` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "version_snapshots" DROP CONSTRAINT "version_snapshots_contentFieldId_fkey";

-- AlterTable
ALTER TABLE "ai_audit_logs" ADD COLUMN     "aiResponse" TEXT,
ADD COLUMN     "fieldKey" TEXT,
ADD COLUMN     "newValue" TEXT,
ADD COLUMN     "pageSlug" TEXT,
ADD COLUMN     "previousValue" TEXT,
ADD COLUMN     "source" "ChangeSource" NOT NULL DEFAULT 'AI',
ADD COLUMN     "userId" TEXT,
ADD COLUMN     "userPrompt" TEXT,
ADD COLUMN     "wasApplied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "wasRejected" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "version_snapshots" ADD COLUMN     "fieldKey" TEXT NOT NULL,
ADD COLUMN     "pageSlug" TEXT NOT NULL,
ALTER COLUMN "contentFieldId" DROP NOT NULL,
ALTER COLUMN "page" DROP NOT NULL,
ALTER COLUMN "field" DROP NOT NULL,
ALTER COLUMN "source" DROP DEFAULT,
ALTER COLUMN "changedBy" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "version_snapshots" ADD CONSTRAINT "version_snapshots_contentFieldId_fkey" FOREIGN KEY ("contentFieldId") REFERENCES "content_fields"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_audit_logs" ADD CONSTRAINT "ai_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
