/*
  Warnings:

  - Made the column `page` on table `version_snapshots` required. This step will fail if there are existing NULL values in that column.
  - Made the column `field` on table `version_snapshots` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "version_snapshots" ALTER COLUMN "page" SET NOT NULL,
ALTER COLUMN "page" SET DEFAULT '',
ALTER COLUMN "field" SET NOT NULL,
ALTER COLUMN "field" SET DEFAULT '';
