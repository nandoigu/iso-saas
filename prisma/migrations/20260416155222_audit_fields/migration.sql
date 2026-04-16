-- AlterTable
ALTER TABLE "Requirement" ADD COLUMN     "evidencia" TEXT,
ADD COLUMN     "norma" TEXT,
ADD COLUMN     "status" TEXT DEFAULT 'no_conforme';
