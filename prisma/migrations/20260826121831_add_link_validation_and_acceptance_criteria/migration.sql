-- AlterTable
ALTER TABLE "EvidenceRequirementLink" ADD COLUMN     "validatedAt" TIMESTAMP(3),
ADD COLUMN     "validatedBy" TEXT;

-- AlterTable
ALTER TABLE "RequirementTemplate" ADD COLUMN     "criterioAceptacion" TEXT;

-- AddForeignKey
ALTER TABLE "EvidenceRequirementLink" ADD CONSTRAINT "EvidenceRequirementLink_validatedBy_fkey" FOREIGN KEY ("validatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
