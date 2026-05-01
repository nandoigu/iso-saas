ALTER TABLE "Requirement"
ADD COLUMN "titulo" TEXT NOT NULL DEFAULT '',
ADD COLUMN "descripcion" TEXT NOT NULL DEFAULT '',
ADD COLUMN "templateId" TEXT;

ALTER TABLE "RequirementTemplate"
ADD COLUMN "titulo" TEXT NOT NULL DEFAULT '',
ADD COLUMN "descripcion" TEXT NOT NULL DEFAULT '',
ADD COLUMN "role" TEXT NOT NULL DEFAULT 'general';

UPDATE "Requirement"
SET "titulo" = "name"
WHERE "titulo" = '';

UPDATE "RequirementTemplate"
SET "titulo" = "name"
WHERE "titulo" = '';

CREATE UNIQUE INDEX "Requirement_projectId_templateId_key"
ON "Requirement"("projectId", "templateId");

CREATE UNIQUE INDEX "RequirementTemplate_norma_item_titulo_role_key"
ON "RequirementTemplate"("norma", "item", "titulo", "role");

ALTER TABLE "Requirement"
ADD CONSTRAINT "Requirement_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "RequirementTemplate"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
