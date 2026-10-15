# Domain Model: Documentación de justificación por proyecto

> BAOS Component: Evidence Graph (módulo de catálogo de plantillas documentales)
> Phase: Phase 1 — Technological Foundation
> Date: 2026-10-13
> Status: Draft
> Spec: `docs/component-specs/documentacion-justificacion.md` · ADR: ADR-016

Este modelo cubre la **entrega 1**. Lo de la entrega 2 se anota al final, sin esquema definitivo: depende de ADR-016 Q1.

---

## Conceptual Model

Una **plantilla documental** (`DocumentTemplate`) es un fichero Word o Excel de elaboración propia de Eficax que un proyecto rellena para justificar su ejecución: un acta, un plan, una matriz. Del libro del experto recibe para quién es (uno o varios roles), en qué fase se produce, si es obligatoria, de qué tipo es y si está vigente. Es un catálogo **global**, igual para todos los clientes, como el catálogo de requisitos.

Una plantilla puede justificar varios **requisitos del catálogo** (`RequirementTemplate`), y un requisito puede estar justificado por varias plantillas. Esa relación es `DocumentTemplateRequirement`. Como cada `RequirementTemplate` pertenece a un rol, el vínculo ya lleva el rol dentro: «el Acta de Movilización justifica el 5.5.1 **del adjudicatario principal**».

El experto cambia el catálogo reimportando el libro. Cada vez que una plantilla cambia, se guarda una **versión** (`DocumentTemplateVersion`) con su estado resultante y quién la importó. Así se puede reconstruir qué decía el catálogo cuando un proyecto entregó un documento.

Una plantilla **nunca se borra**: cuando sale del libro o viene con «no», deja de estar vigente y deja de ofrecerse.

## Entities and Responsibilities

| Entity | What it represents | Key attributes |
|--------|-------------------|----------------|
| `DocumentTemplate` | Una plantilla del catálogo, en su estado actual | `fichero` (clave natural), `nombre`, `formato`, `vigente`, `roles[]`, `fase`, `obligatoria`, `tipo`, `version` |
| `DocumentTemplateRequirement` | Qué requisito (de qué rol) justifica una plantilla | `documentTemplateId`, `requirementTemplateId` |
| `DocumentTemplateVersion` | Foto de la plantilla tras cada cambio | `version`, `snapshot` (JSON), `importedBy`, `createdAt` |

Valores cerrados, validados en el servicio:

| Campo | Valores |
|---|---|
| `formato` | `docx`, `xlsx` |
| `roles[]` | `adjudicador`, `adjudicatario_principal`, `adjudicatario` (los de `Project.role`) |
| `fase` | `oferta`, `contratacion`, `movilizacion`, `produccion`, `entrega`, `cierre` (sin acentos en BD; el orden y la etiqueta con acentos viven en código) |
| `tipo` | `iso`, `administrativa`, `ambas` |

## Entity Relationships

```
DocumentTemplate (1) ──── (N) DocumentTemplateRequirement (N) ──── (1) RequirementTemplate
       │                                                                  (lleva role)
       └── (1) ──── (N) DocumentTemplateVersion ──── (1) User (importedBy)

Project.role ──(filtro: role ∈ roles[] y vigente)──> DocumentTemplate      [sin FK]

Entrega 2 (anotado, sin esquema definitivo):
EvidenceItem.documentTemplateId? ──── (1) DocumentTemplate
```

## Prisma Schema

```prisma
// Catalogo global de plantillas documentales (ADR-016). Lo escribe el experto en
// docs/fuentes/trabajo/plantillas_documentales.xlsx; nunca se borra una fila.
model DocumentTemplate {
  id          String   @id @default(cuid())
  fichero     String   @unique // nombre del fichero dentro de docs/fuentes/plantillas-iso/
  nombre      String
  formato     String // "docx" | "xlsx"
  vigente     Boolean  @default(true)
  roles       String[] // subconjunto de los valores de Project.role
  fase        String // "oferta" | "contratacion" | "movilizacion" | "produccion" | "entrega" | "cierre"
  obligatoria Boolean
  tipo        String // "iso" | "administrativa" | "ambas"
  version     Int      @default(1)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdBy   String // userId del admin que la importo por primera vez
  updatedBy   String? // userId del admin de la ultima importacion que la cambio

  creator          User                          @relation("DocumentTemplateCreator", fields: [createdBy], references: [id], onDelete: Restrict)
  requirementLinks DocumentTemplateRequirement[]
  versions         DocumentTemplateVersion[]

  @@index([vigente])
}

model DocumentTemplateRequirement {
  documentTemplateId    String
  requirementTemplateId String
  createdAt             DateTime @default(now())

  documentTemplate    DocumentTemplate    @relation(fields: [documentTemplateId], references: [id], onDelete: Cascade)
  requirementTemplate RequirementTemplate @relation(fields: [requirementTemplateId], references: [id], onDelete: Restrict)

  @@id([documentTemplateId, requirementTemplateId])
  @@index([requirementTemplateId])
}

// ADR-006: el snapshot N describe el estado resultante de la version N.
model DocumentTemplateVersion {
  id                 String   @id @default(cuid())
  documentTemplateId String
  version            Int
  snapshot           Json // campos de DocumentTemplate + ids de requisitos vinculados
  importedBy         String
  createdAt          DateTime @default(now())

  documentTemplate DocumentTemplate @relation(fields: [documentTemplateId], references: [id], onDelete: Cascade)
  importer         User             @relation("DocumentTemplateImporter", fields: [importedBy], references: [id], onDelete: Restrict)

  @@unique([documentTemplateId, version])
}
```

Back-relations que hay que añadir en modelos existentes (sin columnas nuevas):

```prisma
// model User
documentTemplatesCreated  DocumentTemplate[]        @relation("DocumentTemplateCreator")
documentTemplateImports   DocumentTemplateVersion[] @relation("DocumentTemplateImporter")

// model RequirementTemplate
documentTemplateLinks DocumentTemplateRequirement[]
```

La migración es **aditiva pura**: tres tablas nuevas, ningún `ALTER` de columna sobre tablas existentes.

## BAOS Compliance Checklist

- [x] **Tenant isolation**: el catálogo es global por diseño (como `RequirementTemplate`, ADR-003). No contiene datos de cliente. El acceso se acota por el proyecto en el servicio: solo se lista y descarga lo aplicable a un proyecto que el actor puede ver.
- [x] `createdAt` y `updatedAt` en `DocumentTemplate`; `createdAt` en las otras dos, que son de solo inserción.
- [x] Actor: `createdBy`, `updatedBy` e `importedBy`, siempre de la sesión.
- [x] `onDelete` explícito en todas las relaciones.
- [x] Versionado: `DocumentTemplateVersion`, con el criterio de ADR-006.
- [x] Sin decisiones autónomas: el catálogo no decide cumplimiento.
- [x] Sin campos sensibles.
- [ ] Evidence-first: llega en la entrega 2 (`EvidenceItem.documentTemplateId`).

## Invariants and Business Rules

1. **No se borra nunca una `DocumentTemplate`.** Ni el servicio ni ninguna ruta llaman a `delete`. Retirar es `vigente = false`.
2. **Una importación es todo o nada**, en una transacción: si una fila falla, no cambia nada.
3. **Idempotencia**: reimportar el mismo libro no crea versiones ni cambia `version`. Solo hay versión nueva si cambia algún campo o el conjunto de requisitos vinculados.
4. **`version` de la plantilla == número del último snapshot** (como `EvidenceItem`, invariante #5).
5. **Cada `requirementTemplateId` vinculado tiene un `role` incluido en `roles[]`** de la plantilla. El importador solo crea vínculos así.
6. **Cada referencia del libro resuelve para al menos un rol** de su fila; si no, la importación falla.
7. **`fichero` existe en `docs/fuentes/plantillas-iso/`** en el momento de importar.
8. **Plantilla aplicable a un proyecto** = `vigente` y `Project.role ∈ roles`. Es la única condición para listarla y descargarla.

## Integration with Existing Schema

- `RequirementTemplate`: gana una back-relation. Se resuelve por `(role, norma, item)`; la `norma` se guarda sin «ISO» (`19650-2`).
- `User`: dos back-relations nuevas.
- `Project`: ninguna; el filtro usa `Project.role`, que no cambia tras la creación.
- `EvidenceItem` (entrega 2): `documentTemplateId String?` con FK `onDelete: Restrict`, anulable. **No entra en esta migración.**

## Decisiones cerradas (usuario, 13-oct)

1. **Borrar un `RequirementTemplate` vinculado a una plantilla se bloquea** (`onDelete: Restrict`). Hoy `POST /api/import` con `replace=true` (desde `/projects`) hace `requirementTemplate.deleteMany()`: con vínculos, fallaría con un P2003. Esa ruta debe traducirlo a un **409** que explique que hay plantillas documentales que justifican esos requisitos, en lugar de un 500. `scripts/sanear-catalogo-requisitos.mjs` es de un solo uso (agosto) y queda igualmente protegido por la FK.
2. **Se guarda el historial** del catálogo en `DocumentTemplateVersion`.

## Open Questions

Ninguna para la entrega 1.
