/*
  Warnings:

  - You are about to drop the column `status` on the `Requirement` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Requirement" DROP COLUMN "status",
ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT false;
