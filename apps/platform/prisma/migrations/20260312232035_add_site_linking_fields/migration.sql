-- AlterTable
ALTER TABLE "sites" ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ALTER COLUMN "name" DROP NOT NULL;
