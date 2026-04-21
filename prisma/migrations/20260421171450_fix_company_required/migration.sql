-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_companyId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_companyId_fkey";

-- 🔥 SOLUCIÓN CLAVE (AÑADIR AQUÍ)
UPDATE "Project"
SET "companyId" = (SELECT id FROM "Company" LIMIT 1)
WHERE "companyId" IS NULL;

UPDATE "User"
SET "companyId" = (SELECT id FROM "Company" LIMIT 1)
WHERE "companyId" IS NULL;

-- AlterTable
ALTER TABLE "Project" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "companyId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "User"
ADD CONSTRAINT "User_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project"
ADD CONSTRAINT "Project_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;