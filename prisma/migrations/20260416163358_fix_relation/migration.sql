/*
  Warnings:

  - Made the column `status` on table `Requirement` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Requirement" ADD COLUMN     "item" TEXT,
ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "status" DROP DEFAULT;
