DROP INDEX IF EXISTS "RequirementTemplate_norma_item_titulo_role_key";

CREATE UNIQUE INDEX "RequirementTemplate_norma_item_titulo_descripcion_role_key"
ON "RequirementTemplate"("norma", "item", "titulo", "descripcion", "role");
