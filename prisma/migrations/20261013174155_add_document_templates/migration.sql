-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "fichero" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "formato" TEXT NOT NULL,
    "vigente" BOOLEAN NOT NULL DEFAULT true,
    "roles" TEXT[],
    "fase" TEXT NOT NULL,
    "obligatoria" BOOLEAN NOT NULL,
    "tipo" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplateRequirement" (
    "documentTemplateId" TEXT NOT NULL,
    "requirementTemplateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentTemplateRequirement_pkey" PRIMARY KEY ("documentTemplateId","requirementTemplateId")
);

-- CreateTable
CREATE TABLE "DocumentTemplateVersion" (
    "id" TEXT NOT NULL,
    "documentTemplateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "importedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplate_fichero_key" ON "DocumentTemplate"("fichero");

-- CreateIndex
CREATE INDEX "DocumentTemplate_vigente_idx" ON "DocumentTemplate"("vigente");

-- CreateIndex
CREATE INDEX "DocumentTemplateRequirement_requirementTemplateId_idx" ON "DocumentTemplateRequirement"("requirementTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplateVersion_documentTemplateId_version_key" ON "DocumentTemplateVersion"("documentTemplateId", "version");

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplateRequirement" ADD CONSTRAINT "DocumentTemplateRequirement_documentTemplateId_fkey" FOREIGN KEY ("documentTemplateId") REFERENCES "DocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplateRequirement" ADD CONSTRAINT "DocumentTemplateRequirement_requirementTemplateId_fkey" FOREIGN KEY ("requirementTemplateId") REFERENCES "RequirementTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplateVersion" ADD CONSTRAINT "DocumentTemplateVersion_documentTemplateId_fkey" FOREIGN KEY ("documentTemplateId") REFERENCES "DocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplateVersion" ADD CONSTRAINT "DocumentTemplateVersion_importedBy_fkey" FOREIGN KEY ("importedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
