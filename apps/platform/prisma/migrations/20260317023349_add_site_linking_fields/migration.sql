-- AlterTable
ALTER TABLE "sites" ADD COLUMN     "linked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "linkedAt" TIMESTAMP(3);
