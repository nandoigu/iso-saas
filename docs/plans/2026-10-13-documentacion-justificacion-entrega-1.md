# Documentación de justificación, entrega 1 (catálogo visible) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada proyecto vea y descargue las plantillas documentales de Eficax que corresponden a su rol, ordenadas por fase, y que un admin cargue o actualice ese catálogo subiendo el libro del experto desde `/admin`.

**Architecture:** Tres tablas nuevas (`DocumentTemplate`, `DocumentTemplateRequirement`, `DocumentTemplateVersion`). Un parser puro lee la hoja «Plantillas» del libro. Un servicio resuelve ficheros y requisitos y escribe todo o nada en una transacción con versión por cambio. Tres rutas: listado, descarga por streaming desde el bundle (ADR-016 D1) e importación admin. La UI son dos componentes nuevos: la sección «Documentación» del proyecto y el bloque «Catálogo documental» de `/admin`. `POST /api/import` traduce el P2003 a 409.

**Tech Stack:** Next.js 16 App Router (route handlers, runtime Node), Prisma 5 + Neon (rama Test `ep-jolly-resonance`), exceljs, Vitest en serie, estilos de `components/uiStyles.ts`.

**Documentos de origen (no se reabren):** `docs/component-specs/documentacion-justificacion.md`, `docs/adr/ADR-016-catalogo-de-plantillas-documentales.md`, `docs/domain-models/documentacion-justificacion.md`, `docs/api-contracts/documentacion-justificacion.md`, `docs/security-specs/documentacion-justificacion.md`.

## Global Constraints

- **No se inventa contenido normativo.** Rol, fase, obligatoriedad, tipo, vigencia y requisitos salen solo del libro. Los datos de test llevan `SYNTHETIC` en el fichero (`SYNTHETIC-…`), en la norma (`SYNTHETIC-19650-9`) y en los textos (`SYNTHETIC TEST DATA`).
- **«El auditor valora, no rechaza».** Ningún texto nuevo de UI habla de «rechazar».
- **Migración solo aditiva**: tres tablas nuevas, ningún `ALTER` sobre tablas existentes.
- **Antes de cualquier `prisma migrate`: `npx prisma migrate status` y comprobar que el host es `ep-jolly-resonance`.** Si no lo es, parar.
- **Nunca se borra una `DocumentTemplate`** desde código de aplicación. Solo los tests y `scripts/clean-test-tenants.mjs` borran plantillas, y solo las `SYNTHETIC-`.
- **Lo ajeno es 404, nunca 403.** `createdBy`, `updatedBy` e `importedBy` salen de la sesión.
- **Rama `feat/documentacion-justificacion`**, nunca `main`. Fusión final con **squash**.
- Tests: `npm test` (vitest run), en serie (`fileParallelism: false` ya está; no tocarlo). Tras un run fallido: `node scripts/clean-test-tenants.mjs --apply`.
- **Comentarios de código y mensajes de commit sin acentos. Textos de UI y mensajes de error que ve el usuario, con acentos.**
- **Ninguna lógica nueva en `ProjectClient.tsx`**: solo el import, el enlace de navegación y el `<ProjectDocumentsSection />`.
- Los ficheros `route.ts` solo exportan handlers y `runtime`; los helpers van en `app/lib/` o `services/`.
- **Cada commit, migración, push o prueba en navegador espera el «adelante» del usuario.** Los pasos «Commit» de este plan se ejecutan tras ese «adelante».
- Mensajes de commit terminados en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Desviaciones respecto al contrato (para aprobar con el plan)

1. **`scripts/clean-test-tenants.mjs` sí cambia.** El contrato decía que no. Pero `createdBy` e `importedBy` son `Restrict` hacia `User`: si un run falla con plantillas `SYNTHETIC-` vivas, el script no puede borrar los usuarios de test. Se añade el borrado de plantillas `SYNTHETIC-` y de requisitos `SYNTHETIC-19650-9`.
2. **La importación acepta `ficheroPrefix` (solo para tests).** Sin él, un test que importa dos plantillas sintéticas retiraría el catálogo real cargado en Test, y además con un admin de test como `importedBy`. Con `ficheroPrefix: "SYNTHETIC-"` la retirada se limita a las sintéticas. En producción no se pasa: el ámbito es el catálogo entero.
3. **Las tres causas de 404 de la descarga devuelven el mismo cuerpo, «Plantilla no encontrada.»** (proyecto ajeno o inexistente; plantilla inexistente, no vigente o no aplicable). Así no se distingue nada. El listado mantiene «Proyecto no encontrado.».
4. **`fichero` se guarda con el nombre real en disco**, buscado en NFC. Las tildes del Excel y del sistema de ficheros pueden venir compuestas de forma distinta (`Movilización`, `Aprobación`).
5. **El smoke admite `method`**, para comprobar que `POST /api/admin/document-templates/import` responde 401 sin sesión.

---

## Estructura de ficheros

| Fichero | Responsabilidad | Acción |
|---|---|---|
| `prisma/schema.prisma` | 3 modelos y 3 back-relations | Modificar |
| `prisma/migrations/<ts>_add_document_templates/migration.sql` | Migración aditiva | Crear (generada) |
| `services/document-template.types.ts` | Constantes y tipos del contrato | Crear |
| `app/lib/documentTemplateImport.ts` | Parser puro del libro (sin BD) | Crear |
| `services/document-template.paths.ts` | Directorio de plantillas (punto único, mockeable) | Crear |
| `services/document-template.service.ts` | Importación, listado aplicable, resolución del fichero | Crear |
| `app/lib/contentDisposition.ts` | Cabecera `Content-Disposition` segura | Crear |
| `app/lib/prismaErrors.ts` | `isForeignKeyError` | Crear |
| `app/api/projects/[id]/document-templates/route.ts` | GET listado | Crear |
| `app/api/projects/[id]/document-templates/[templateId]/file/route.ts` | GET descarga | Crear |
| `app/api/admin/document-templates/import/route.ts` | POST importación | Crear |
| `app/api/import/route.ts` | 409 por P2003 | Modificar |
| `next.config.ts` | `outputFileTracingIncludes` | Modificar |
| `app/projects/[id]/ProjectDocumentsSection.tsx` | Sección «Documentación» | Crear |
| `app/projects/[id]/ProjectClient.tsx` | Import, enlace y montaje (sin lógica) | Modificar |
| `app/admin/DocumentCatalogImport.tsx` | Bloque «Catálogo documental» | Crear |
| `app/admin/AdminPanelClient.tsx` | Montar el bloque | Modificar |
| `scripts/smoke-routes.mjs` | 3 comprobaciones 401 | Modificar |
| `scripts/clean-test-tenants.mjs` | Borrar plantillas `SYNTHETIC-` | Modificar |
| `tests/helpers/document-templates.ts` | Fixtures y limpieza sintéticos | Crear |
| `tests/lib/documentTemplateImport.test.ts` | Parser | Crear |
| `tests/lib/contentDisposition.test.ts` | Cabecera | Crear |
| `tests/services/document-template.service.test.ts` | Servicio contra Test | Crear |
| `tests/api/document-templates.test.ts` | Rutas de listado y descarga | Crear |
| `tests/api/document-templates-import.test.ts` | Ruta admin + 409 de `/api/import` | Crear |
| `docs/test-plans/documentacion-justificacion.md` | Test plan | Crear (Task 11) |

---

### Task 1: Esquema y migración en Test

**Files:**
- Modify: `prisma/schema.prisma` (modelos `User`, `RequirementTemplate`; tres modelos nuevos al final)
- Create: `prisma/migrations/<timestamp>_add_document_templates/migration.sql` (la genera Prisma)

**Interfaces:**
- Produces: modelos Prisma `documentTemplate`, `documentTemplateRequirement`, `documentTemplateVersion` en el cliente generado.

- [ ] **Step 1: Comprobar a qué base apunta el CLI**

Run: `npx prisma migrate status`
Expected: una línea `Datasource "db": PostgreSQL database "neondb", schema "public" at "ep-jolly-resonance-…"` y `Database schema is up to date!`. **Si el host no es `ep-jolly-resonance`, parar y avisar al usuario.**

- [ ] **Step 2: Añadir las back-relations**

En `model User`, después de `analysisDocuments AnalysisDocument[] @relation("AnalysisDocumentCreator")`:

```prisma
  documentTemplatesCreated DocumentTemplate[]        @relation("DocumentTemplateCreator")
  documentTemplateImports  DocumentTemplateVersion[] @relation("DocumentTemplateImporter")
```

En `model RequirementTemplate`, después de `requirements Requirement[]`:

```prisma
  documentTemplateLinks DocumentTemplateRequirement[]
```

- [ ] **Step 3: Añadir los tres modelos al final de `schema.prisma`**

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

- [ ] **Step 4: Generar la migración sin aplicarla**

Run: `npx prisma migrate dev --name add_document_templates --create-only`
Expected: `Prisma Migration created … prisma/migrations/<ts>_add_document_templates/migration.sql`. Si Prisma pide **reset** por drift: responder que no y parar.

- [ ] **Step 5: Revisar el SQL**

Leer `migration.sql`. Debe contener solo `CREATE TABLE` de las tres tablas, `CREATE INDEX` / `CREATE UNIQUE INDEX` sobre ellas y `ALTER TABLE "DocumentTemplate…" ADD CONSTRAINT … FOREIGN KEY`. Ningún `ALTER TABLE "User"`, `"RequirementTemplate"` ni `DROP`. Las FK hacia `User` y `RequirementTemplate` deben ser `ON DELETE RESTRICT`.

- [ ] **Step 6: Aplicar en Test y regenerar el cliente**

Run: `npx prisma migrate status` (repetir la comprobación del host), luego `npx prisma migrate deploy` y `npx prisma generate`.
Expected: `Applying migration <ts>_add_document_templates` y `All migrations have been successfully applied.`

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): catalogo de plantillas documentales (3 tablas aditivas, ADR-016)"
```

---

### Task 2: Tipos y parser del libro

**Files:**
- Create: `services/document-template.types.ts`
- Create: `app/lib/documentTemplateImport.ts`
- Test: `tests/lib/documentTemplateImport.test.ts`

**Interfaces:**
- Produces:
  - `FASES_ORDEN`, `Fase`, `FASE_ETIQUETA`, `PROJECT_ROLES`, `ProjectRole`, `FORMATOS`, `Formato`, `TIPOS`, `Tipo`, `ParsedDocumentTemplateRow`, `ProjectDocumentTemplate`, `DocumentTemplateImportSummary`, `DocumentTemplateActor`.
  - `parseDocumentTemplateWorkbook(buffer: ArrayBuffer): Promise<{ rows: ParsedDocumentTemplateRow[]; errors: string[] }>`. Con errores, `rows` sale vacío.
  - `parseReferencias(texto: string): { referencias: { norma: string; item: string }[] } | { error: string }`.

- [ ] **Step 1: Crear los tipos**

`services/document-template.types.ts`:

```typescript
// Tipos y constantes del catalogo documental (contrato: docs/api-contracts/documentacion-justificacion.md).
// Sin imports de servidor: lo usan tambien los componentes de cliente.

export const FASES_ORDEN = [
  "oferta",
  "contratacion",
  "movilizacion",
  "produccion",
  "entrega",
  "cierre",
] as const;
export type Fase = (typeof FASES_ORDEN)[number];

export const FASE_ETIQUETA: Record<Fase, string> = {
  oferta: "Oferta",
  contratacion: "Contratación",
  movilizacion: "Movilización",
  produccion: "Producción",
  entrega: "Entrega",
  cierre: "Cierre",
};

export const PROJECT_ROLES = ["adjudicador", "adjudicatario_principal", "adjudicatario"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const FORMATOS = ["docx", "xlsx"] as const;
export type Formato = (typeof FORMATOS)[number];

export const TIPOS = ["iso", "administrativa", "ambas"] as const;
export type Tipo = (typeof TIPOS)[number];

// Fila del libro ya normalizada por el parser (antes de resolver requisitos)
export type ParsedDocumentTemplateRow = {
  fila: number;
  fichero: string;
  nombre: string;
  formato: Formato;
  vigente: boolean;
  roles: ProjectRole[];
  fase: Fase;
  obligatoria: boolean;
  tipo: Tipo;
  referencias: { norma: string; item: string }[];
};

export type ProjectDocumentTemplate = {
  id: string;
  nombre: string;
  formato: string;
  fase: string;
  obligatoria: boolean;
  tipo: string;
};

export type DocumentTemplateImportSummary = {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  retired: number;
  links: number;
};

export type DocumentTemplateActor = {
  userId: string;
  isAdmin: boolean;
};
```

- [ ] **Step 2: Escribir el test del parser (falla)**

`tests/lib/documentTemplateImport.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  parseDocumentTemplateWorkbook,
  parseReferencias,
} from "@/app/lib/documentTemplateImport";

// Cabecera real del libro del experto (13-oct), con sus aclaraciones entre parentesis.
const CABECERA = [
  "Fichero",
  "Formato",
  "Nombre (corregir)",
  "Vigente",
  "Rol (uno o varios, separados por coma)",
  "Fase",
  "Obligatoria",
  "Tipo",
  "Requisitos que justifica (norma / item; separados por punto y coma)",
  "Observaciones",
];

// SYNTHETIC TEST DATA: ficheros y norma inventados, marcados como tales.
const FILA_VALIDA = [
  "SYNTHETIC-Acta.docx",
  "docx",
  "SYNTHETIC Acta",
  "sí",
  "adjudicatario, adjudicatario principal, adjudicador",
  "Movilización",
  "Si",
  "ambas",
  "ISO SYNTHETIC-19650-9/1.1;1.2, 1.3",
  "",
];

async function libro(filas: string[][], hoja = "Plantillas"): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(hoja);
  for (const fila of filas) sheet.addRow(fila);
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

describe("parseDocumentTemplateWorkbook", () => {
  it("normaliza una fila valida", async () => {
    const resultado = await parseDocumentTemplateWorkbook(await libro([CABECERA, FILA_VALIDA]));

    expect(resultado.errors).toEqual([]);
    expect(resultado.rows).toEqual([
      {
        fila: 2,
        fichero: "SYNTHETIC-Acta.docx",
        nombre: "SYNTHETIC Acta",
        formato: "docx",
        vigente: true,
        roles: ["adjudicador", "adjudicatario_principal", "adjudicatario"],
        fase: "movilizacion",
        obligatoria: true,
        tipo: "ambas",
        referencias: [
          { norma: "SYNTHETIC-19650-9", item: "1.1" },
          { norma: "SYNTHETIC-19650-9", item: "1.2" },
          { norma: "SYNTHETIC-19650-9", item: "1.3" },
        ],
      },
    ]);
  });

  it("acepta requisitos vacios y vigente no", async () => {
    const fila = [...FILA_VALIDA];
    fila[3] = "NO";
    fila[8] = "";
    const resultado = await parseDocumentTemplateWorkbook(await libro([CABECERA, fila]));

    expect(resultado.errors).toEqual([]);
    expect(resultado.rows[0].vigente).toBe(false);
    expect(resultado.rows[0].referencias).toEqual([]);
  });

  it("ignora las filas vacias", async () => {
    const resultado = await parseDocumentTemplateWorkbook(
      await libro([CABECERA, FILA_VALIDA, ["", "", "", "", "", "", "", "", "", ""]])
    );
    expect(resultado.errors).toEqual([]);
    expect(resultado.rows).toHaveLength(1);
  });

  it("acumula los errores de todas las filas y no devuelve filas", async () => {
    const rolMalo = [...FILA_VALIDA];
    rolMalo[4] = "auditor";
    const faseMala = [...FILA_VALIDA];
    faseMala[0] = "SYNTHETIC-Otra.docx";
    faseMala[5] = "explotacion";

    const resultado = await parseDocumentTemplateWorkbook(
      await libro([CABECERA, FILA_VALIDA, rolMalo, faseMala])
    );

    expect(resultado.rows).toEqual([]);
    expect(resultado.errors.some((e) => e.startsWith("Fila 3:") && e.includes("auditor"))).toBe(true);
    expect(resultado.errors.some((e) => e.startsWith("Fila 4:") && e.includes("explotacion"))).toBe(true);
  });

  it.each(["../secreto.docx", "sub/a.docx", "sub\\a.docx"])(
    "rechaza un fichero con ruta: %s",
    async (fichero) => {
      const fila = [...FILA_VALIDA];
      fila[0] = fichero;
      const resultado = await parseDocumentTemplateWorkbook(await libro([CABECERA, fila]));
      expect(resultado.errors).toHaveLength(1);
      expect(resultado.errors[0]).toMatch(/^Fila 2: el fichero/);
    }
  );

  it("rechaza un formato que no coincide con la extension", async () => {
    const fila = [...FILA_VALIDA];
    fila[1] = "xlsx";
    const resultado = await parseDocumentTemplateWorkbook(await libro([CABECERA, fila]));
    expect(resultado.errors[0]).toMatch(/^Fila 2: el formato xlsx no coincide/);
  });

  it("rechaza un fichero repetido", async () => {
    const resultado = await parseDocumentTemplateWorkbook(
      await libro([CABECERA, FILA_VALIDA, FILA_VALIDA])
    );
    expect(resultado.errors).toEqual(["Fila 3: el fichero ya aparece en la fila 2."]);
  });

  it("exige la hoja Plantillas", async () => {
    const resultado = await parseDocumentTemplateWorkbook(await libro([CABECERA], "Hoja1"));
    expect(resultado.errors).toEqual(["El libro no tiene la hoja «Plantillas»."]);
  });

  it("exige todas las columnas", async () => {
    const resultado = await parseDocumentTemplateWorkbook(
      await libro([CABECERA.filter((c) => c !== "Fase"), FILA_VALIDA])
    );
    expect(resultado.errors).toEqual(["Faltan columnas en la hoja «Plantillas»: fase."]);
  });
});

describe("parseReferencias", () => {
  it("arrastra la norma y admite prefijo ISO y separadores mezclados", () => {
    expect(parseReferencias("ISO 19650-2/5.3.1;5.6.3, 5.6.5; 19650-1/4.1")).toEqual({
      referencias: [
        { norma: "19650-2", item: "5.3.1" },
        { norma: "19650-2", item: "5.6.3" },
        { norma: "19650-2", item: "5.6.5" },
        { norma: "19650-1", item: "4.1" },
      ],
    });
  });

  it("falla si la primera referencia no lleva norma", () => {
    expect(parseReferencias("5.3.1")).toEqual({
      error: "la referencia «5.3.1» no indica la norma (por ejemplo, 19650-2/5.3.1).",
    });
  });

  it("devuelve lista vacia para texto vacio", () => {
    expect(parseReferencias("  ")).toEqual({ referencias: [] });
  });
});
```

- [ ] **Step 3: Verificar que falla**

Run: `npx vitest run tests/lib/documentTemplateImport.test.ts`
Expected: FAIL, `Failed to resolve import "@/app/lib/documentTemplateImport"`.

- [ ] **Step 4: Implementar el parser**

`app/lib/documentTemplateImport.ts`:

```typescript
import ExcelJS from "exceljs";
import {
  FASES_ORDEN,
  FORMATOS,
  PROJECT_ROLES,
  TIPOS,
  type ParsedDocumentTemplateRow,
  type ProjectRole,
} from "@/services/document-template.types";

// Parser puro del libro plantillas_documentales.xlsx (ADR-016 D2). No toca la base:
// la existencia del fichero y la resolucion de requisitos son del servicio.

export const DOCUMENT_TEMPLATE_SHEET = "Plantillas";

// Mismos limites que requirementImport.ts (security-spec).
const MAX_WORKBOOK_ROWS = 2000;
const MAX_WORKBOOK_COLUMNS = 50;
const MAX_CELL_TEXT_LENGTH = 10000;

// Cabecera normalizada (sin tildes, minusculas, sin el texto entre parentesis).
const COLUMNAS = {
  fichero: "fichero",
  formato: "formato",
  nombre: "nombre",
  vigente: "vigente",
  rol: "rol",
  fase: "fase",
  obligatoria: "obligatoria",
  tipo: "tipo",
  requisitos: "requisitos que justifica",
} as const;
type Columna = keyof typeof COLUMNAS;
const NOMBRES_COLUMNA = Object.keys(COLUMNAS) as Columna[];

export type DocumentTemplateParseResult = {
  rows: ParsedDocumentTemplateRow[];
  errors: string[];
};

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export async function parseDocumentTemplateWorkbook(
  buffer: ArrayBuffer
): Promise<DocumentTemplateParseResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    return fallo("No se pudo leer el libro.");
  }

  const sheet = workbook.getWorksheet(DOCUMENT_TEMPLATE_SHEET);
  if (!sheet) return fallo(`El libro no tiene la hoja «${DOCUMENT_TEMPLATE_SHEET}».`);
  if (sheet.rowCount > MAX_WORKBOOK_ROWS + 1) {
    return fallo(`La hoja «${DOCUMENT_TEMPLATE_SHEET}» supera las ${MAX_WORKBOOK_ROWS} filas.`);
  }
  if (sheet.columnCount > MAX_WORKBOOK_COLUMNS) {
    return fallo(`La hoja «${DOCUMENT_TEMPLATE_SHEET}» supera las ${MAX_WORKBOOK_COLUMNS} columnas.`);
  }

  const indices: Partial<Record<Columna, number>> = {};
  sheet.getRow(1).eachCell((cell, columna) => {
    const clave = normalizeText(cell.text).split("(")[0].trim();
    for (const nombre of NOMBRES_COLUMNA) {
      if (clave === COLUMNAS[nombre] && indices[nombre] === undefined) indices[nombre] = columna;
    }
  });
  const faltan = NOMBRES_COLUMNA.filter((c) => indices[c] === undefined);
  if (faltan.length > 0) {
    return fallo(`Faltan columnas en la hoja «${DOCUMENT_TEMPLATE_SHEET}»: ${faltan.join(", ")}.`);
  }

  const rows: ParsedDocumentTemplateRow[] = [];
  const errors: string[] = [];
  const vistos = new Map<string, number>();

  for (let n = 2; n <= sheet.rowCount; n++) {
    const row = sheet.getRow(n);
    const leer = (c: Columna) => row.getCell(indices[c]!).text.trim();
    const valores = NOMBRES_COLUMNA.map(leer);

    if (valores.every((v) => v === "")) continue;
    if (valores.some((v) => v.length > MAX_CELL_TEXT_LENGTH)) {
      errors.push(`Fila ${n}: una celda supera los ${MAX_CELL_TEXT_LENGTH} caracteres.`);
      continue;
    }

    const resultado = parseFila(n, leer);
    if ("errores" in resultado) {
      errors.push(...resultado.errores);
      continue;
    }

    const previa = vistos.get(resultado.fila.fichero);
    if (previa !== undefined) {
      errors.push(`Fila ${n}: el fichero ya aparece en la fila ${previa}.`);
      continue;
    }
    vistos.set(resultado.fila.fichero, n);
    rows.push(resultado.fila);
  }

  return { rows: errors.length > 0 ? [] : rows, errors };
}

function parseFila(
  n: number,
  leer: (c: Columna) => string
): { fila: ParsedDocumentTemplateRow } | { errores: string[] } {
  const errores: string[] = [];
  const error = (mensaje: string) => errores.push(`Fila ${n}: ${mensaje}`);

  const fichero = leer("fichero").normalize("NFC");
  if (!fichero) {
    error("falta el fichero.");
  } else if (/[\\/]|\.\.|[\u0000-\u001f\u007f]/.test(fichero)) {
    error(`el fichero «${fichero}» no puede contener rutas ni caracteres de control.`);
  }

  const formato = normalizeText(leer("formato"));
  if (!esUno(FORMATOS, formato)) {
    error(`formato «${leer("formato")}» no válido (docx o xlsx).`);
  } else if (fichero && !fichero.toLowerCase().endsWith(`.${formato}`)) {
    error(`el formato ${formato} no coincide con la extensión de «${fichero}».`);
  }

  const nombre = leer("nombre").replace(/\s+/g, " ");
  if (!nombre) error("falta el nombre.");

  const vigente = siNo(leer("vigente"));
  if (vigente === null) error(`Vigente debe ser «sí» o «no» (hay «${leer("vigente")}»).`);

  const obligatoria = siNo(leer("obligatoria"));
  if (obligatoria === null) error(`Obligatoria debe ser «sí» o «no» (hay «${leer("obligatoria")}»).`);

  const roles: ProjectRole[] = [];
  const partesRol = leer("rol").split(",").map(normalizeText).filter(Boolean);
  if (partesRol.length === 0) error("falta el rol.");
  for (const parte of partesRol) {
    const rol = parte.replace(/ /g, "_");
    if (!esUno(PROJECT_ROLES, rol)) error(`rol «${parte}» no válido.`);
    else if (!roles.includes(rol)) roles.push(rol);
  }
  roles.sort((a, b) => PROJECT_ROLES.indexOf(a) - PROJECT_ROLES.indexOf(b));

  const fase = normalizeText(leer("fase"));
  if (!esUno(FASES_ORDEN, fase)) error(`fase «${leer("fase")}» no válida.`);

  const tipo = normalizeText(leer("tipo"));
  if (!esUno(TIPOS, tipo)) error(`tipo «${leer("tipo")}» no válido (iso, administrativa o ambas).`);

  const referencias = parseReferencias(leer("requisitos"));
  if ("error" in referencias) error(referencias.error);

  if (errores.length > 0 || "error" in referencias) return { errores };

  return {
    fila: {
      fila: n,
      fichero,
      nombre,
      formato: formato as ParsedDocumentTemplateRow["formato"],
      vigente: vigente!,
      roles,
      fase: fase as ParsedDocumentTemplateRow["fase"],
      obligatoria: obligatoria!,
      tipo: tipo as ParsedDocumentTemplateRow["tipo"],
      referencias: referencias.referencias,
    },
  };
}

/**
 * Lee «ISO 19650-2/5.3.1;5.6.3, 5.6.5». Separador `;` o `,`, prefijo ISO opcional y la
 * norma se arrastra a las referencias siguientes que no la repiten (usuario, 13-oct).
 */
export function parseReferencias(
  texto: string
): { referencias: { norma: string; item: string }[] } | { error: string } {
  const referencias: { norma: string; item: string }[] = [];
  let norma: string | null = null;

  for (const trozo of texto.split(/[;,]/).map((t) => t.trim()).filter(Boolean)) {
    const sinPrefijo = trozo.replace(/^iso\s*/i, "");
    const barra = sinPrefijo.indexOf("/");
    let item: string;
    if (barra >= 0) {
      norma = sinPrefijo.slice(0, barra).trim();
      item = sinPrefijo.slice(barra + 1).trim();
    } else {
      item = sinPrefijo;
    }

    if (!norma) {
      return { error: `la referencia «${trozo}» no indica la norma (por ejemplo, 19650-2/5.3.1).` };
    }
    if (!item || item.includes("/")) {
      return { error: `la referencia «${trozo}» no tiene un ítem válido.` };
    }
    const actual = norma;
    if (!referencias.some((r) => r.norma === actual && r.item === item)) {
      referencias.push({ norma: actual, item });
    }
  }

  return { referencias };
}

function esUno<T extends string>(valores: readonly T[], valor: string): valor is T {
  return (valores as readonly string[]).includes(valor);
}

function siNo(valor: string): boolean | null {
  const normalizado = normalizeText(valor);
  if (normalizado === "si") return true;
  if (normalizado === "no") return false;
  return null;
}

function fallo(mensaje: string): DocumentTemplateParseResult {
  return { rows: [], errors: [mensaje] };
}
```

- [ ] **Step 5: Verificar que pasa**

Run: `npx vitest run tests/lib/documentTemplateImport.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 6: Probar el parser contra el libro real (sin escribir nada)**

Run: `npx vitest run tests/lib/documentTemplateImport.test.ts` con este bloque añadido **temporalmente** al final del fichero:

```typescript
import { readFile } from "fs/promises";
it("TEMPORAL: libro real", async () => {
  const buffer = await readFile("docs/fuentes/trabajo/plantillas_documentales.xlsx");
  const r = await parseDocumentTemplateWorkbook(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
  console.log(r.errors, r.rows.length, r.rows.reduce((n, f) => n + f.referencias.length, 0));
  expect(r.errors).toEqual([]);
  expect(r.rows).toHaveLength(23);
});
```

Expected: PASS, `[] 23 <nº de referencias>`. **Quitar el bloque** antes del commit (el libro no está en git).

- [ ] **Step 7: Commit**

```bash
git add services/document-template.types.ts app/lib/documentTemplateImport.ts tests/lib/documentTemplateImport.test.ts
git commit -m "feat: parser del libro de plantillas documentales"
```

---

### Task 3: Servicio de importación

**Files:**
- Create: `services/document-template.paths.ts`
- Create: `services/document-template.service.ts`
- Create: `tests/helpers/document-templates.ts`
- Test: `tests/services/document-template.service.test.ts`

**Interfaces:**
- Consumes: `ParsedDocumentTemplateRow`, `PROJECT_ROLES`, `DocumentTemplateImportSummary` (Task 2).
- Produces:
  - `getPlantillasDir(): string`
  - `importDocumentTemplates(rows: ParsedDocumentTemplateRow[], actorId: string, options?: { dir?: string; ficheroPrefix?: string }): Promise<{ ok: true; summary: DocumentTemplateImportSummary } | { ok: false; errors: string[] }>`
  - Helpers de test: `SYNTHETIC_PREFIX`, `SYNTHETIC_NORMA`, `createSyntheticTemplatesDir(ficheros)`, `createSyntheticRequirementTemplate(item, role)`, `createSyntheticDocumentTemplate(createdBy, overrides)`, `cleanupSyntheticDocumentTemplates()`, `cleanupSyntheticRequirementTemplates()`.

- [ ] **Step 1: Crear el punto único del directorio**

`services/document-template.paths.ts`:

```typescript
import path from "path";

// Los binarios viajan dentro del bundle de las rutas que los leen (ADR-016 D1,
// outputFileTracingIncludes en next.config.ts). Punto unico para poder mockearlo en tests.
export function getPlantillasDir() {
  return path.join(process.cwd(), "docs", "fuentes", "plantillas-iso");
}
```

- [ ] **Step 2: Crear los helpers de test**

`tests/helpers/document-templates.ts`:

```typescript
import { mkdtemp, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { prisma } from "@/app/lib/prisma";

// SYNTHETIC TEST DATA. Nada de lo que crean estos helpers es contenido normativo real.
export const SYNTHETIC_PREFIX = "SYNTHETIC-";
export const SYNTHETIC_NORMA = "SYNTHETIC-19650-9";

export async function createSyntheticTemplatesDir(ficheros: string[]) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "plantillas-"));
  for (const fichero of ficheros) {
    await writeFile(path.join(dir, fichero), `SYNTHETIC TEST DATA ${fichero}`);
  }
  return dir;
}

export async function createSyntheticRequirementTemplate(item: string, role: string) {
  return prisma.requirementTemplate.create({
    data: {
      norma: SYNTHETIC_NORMA,
      item,
      name: `SYNTHETIC TEST DATA ${item}`,
      titulo: `SYNTHETIC TEST DATA ${item}`,
      descripcion: `SYNTHETIC TEST DATA ${item} ${role}`,
      role,
      defaultStatus: "no_conforme",
    },
  });
}

export async function createSyntheticDocumentTemplate(
  createdBy: string,
  overrides: {
    fichero: string;
    nombre?: string;
    formato?: string;
    vigente?: boolean;
    roles?: string[];
    fase?: string;
    obligatoria?: boolean;
    tipo?: string;
  }
) {
  return prisma.documentTemplate.create({
    data: {
      fichero: overrides.fichero,
      nombre: overrides.nombre ?? `SYNTHETIC TEST DATA ${overrides.fichero}`,
      formato: overrides.formato ?? "docx",
      vigente: overrides.vigente ?? true,
      roles: overrides.roles ?? ["adjudicatario"],
      fase: overrides.fase ?? "oferta",
      obligatoria: overrides.obligatoria ?? true,
      tipo: overrides.tipo ?? "ambas",
      createdBy,
    },
  });
}

// Unico codigo, junto a scripts/clean-test-tenants.mjs, que borra plantillas. Tiene que
// correr antes de cleanupTenant: createdBy e importedBy son Restrict hacia User.
export async function cleanupSyntheticDocumentTemplates() {
  // Versiones y vinculos caen en cascada.
  await prisma.documentTemplate.deleteMany({
    where: { fichero: { startsWith: SYNTHETIC_PREFIX } },
  });
}

export async function cleanupSyntheticRequirementTemplates() {
  await prisma.documentTemplateRequirement.deleteMany({
    where: { requirementTemplate: { norma: SYNTHETIC_NORMA } },
  });
  await prisma.requirementTemplate.deleteMany({ where: { norma: SYNTHETIC_NORMA } });
}
```

- [ ] **Step 3: Escribir el test del servicio de importación (falla)**

`tests/services/document-template.service.test.ts`:

```typescript
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { rm } from "fs/promises";
import { prisma } from "@/app/lib/prisma";
import { importDocumentTemplates } from "@/services/document-template.service";
import type { ParsedDocumentTemplateRow } from "@/services/document-template.types";
import { cleanupTenant, createTenant } from "../helpers/db";
import {
  SYNTHETIC_NORMA,
  SYNTHETIC_PREFIX,
  cleanupSyntheticDocumentTemplates,
  cleanupSyntheticRequirementTemplates,
  createSyntheticRequirementTemplate,
  createSyntheticTemplatesDir,
} from "../helpers/document-templates";

const ACTA = "SYNTHETIC-svc-Acta.docx";
const MATRIZ = "SYNTHETIC-svc-Matriz.xlsx";

let tenant: Awaited<ReturnType<typeof createTenant>>;
let dir: string;
let req: Record<string, string>;

function fila(overrides: Partial<ParsedDocumentTemplateRow> = {}): ParsedDocumentTemplateRow {
  return {
    fila: 2,
    fichero: ACTA,
    nombre: "SYNTHETIC TEST DATA Acta",
    formato: "docx",
    vigente: true,
    roles: ["adjudicador", "adjudicatario_principal"],
    fase: "movilizacion",
    obligatoria: true,
    tipo: "ambas",
    referencias: [
      { norma: SYNTHETIC_NORMA, item: "1.1" },
      { norma: SYNTHETIC_NORMA, item: "2.1" },
    ],
    ...overrides,
  };
}

const importar = (rows: ParsedDocumentTemplateRow[]) =>
  importDocumentTemplates(rows, tenant.admin.id, { dir, ficheroPrefix: SYNTHETIC_PREFIX });

const sinteticas = () =>
  prisma.documentTemplate.findMany({
    where: { fichero: { startsWith: SYNTHETIC_PREFIX } },
    include: { requirementLinks: true, versions: { orderBy: { version: "asc" } } },
    orderBy: { fichero: "asc" },
  });

beforeAll(async () => {
  tenant = await createTenant("doc-templates-svc");
  dir = await createSyntheticTemplatesDir([ACTA, MATRIZ]);
  await cleanupSyntheticDocumentTemplates();
  await cleanupSyntheticRequirementTemplates();
  // 1.1 existe para adjudicador y adjudicatario; 2.1 solo para adjudicatario_principal.
  req = {
    adjudicador11: (await createSyntheticRequirementTemplate("1.1", "adjudicador")).id,
    adjudicatario11: (await createSyntheticRequirementTemplate("1.1", "adjudicatario")).id,
    principal21: (await createSyntheticRequirementTemplate("2.1", "adjudicatario_principal")).id,
  };
});

beforeEach(async () => {
  await cleanupSyntheticDocumentTemplates();
});

afterAll(async () => {
  await cleanupSyntheticDocumentTemplates();
  await cleanupSyntheticRequirementTemplates();
  await cleanupTenant(tenant.company.id);
  await rm(dir, { recursive: true, force: true });
});

describe("importDocumentTemplates", () => {
  it("crea la plantilla en version 1 y vincula cada requisito solo a los roles de la fila", async () => {
    const resultado = await importar([fila()]);

    expect(resultado).toEqual({
      ok: true,
      summary: { total: 1, created: 1, updated: 0, unchanged: 0, retired: 0, links: 2 },
    });
    const [plantilla] = await sinteticas();
    expect(plantilla.version).toBe(1);
    expect(plantilla.createdBy).toBe(tenant.admin.id);
    expect(plantilla.requirementLinks.map((l) => l.requirementTemplateId).sort()).toEqual(
      [req.adjudicador11, req.principal21].sort()
    );
    expect(plantilla.versions).toHaveLength(1);
    expect(plantilla.versions[0]).toMatchObject({ version: 1, importedBy: tenant.admin.id });
    expect(plantilla.versions[0].snapshot).toMatchObject({ fichero: ACTA, nombre: "SYNTHETIC TEST DATA Acta" });
  });

  it("es idempotente: reimportar lo mismo no crea version", async () => {
    await importar([fila()]);
    const resultado = await importar([fila()]);

    expect(resultado).toMatchObject({ ok: true, summary: { created: 0, updated: 0, unchanged: 1 } });
    const [plantilla] = await sinteticas();
    expect(plantilla.version).toBe(1);
    expect(plantilla.versions).toHaveLength(1);
  });

  it("un cambio crea la version 2 con el estado resultante", async () => {
    await importar([fila()]);
    const resultado = await importar([fila({ nombre: "SYNTHETIC TEST DATA Acta v2", referencias: [] })]);

    expect(resultado).toMatchObject({ ok: true, summary: { updated: 1, links: 0 } });
    const [plantilla] = await sinteticas();
    expect(plantilla.version).toBe(2);
    expect(plantilla.updatedBy).toBe(tenant.admin.id);
    expect(plantilla.requirementLinks).toEqual([]);
    expect(plantilla.versions[1]).toMatchObject({ version: 2 });
    expect(plantilla.versions[1].snapshot).toMatchObject({
      nombre: "SYNTHETIC TEST DATA Acta v2",
      requirementTemplateIds: [],
    });
  });

  it("retira sin borrar la plantilla que sale del libro, una sola vez", async () => {
    await importar([fila(), fila({ fila: 3, fichero: MATRIZ, formato: "xlsx", referencias: [] })]);

    const primera = await importar([fila()]);
    expect(primera).toMatchObject({ ok: true, summary: { retired: 1, unchanged: 1 } });
    const segunda = await importar([fila()]);
    expect(segunda).toMatchObject({ ok: true, summary: { retired: 0 } });

    const matriz = (await sinteticas()).find((p) => p.fichero === MATRIZ)!;
    expect(matriz.vigente).toBe(false);
    expect(matriz.version).toBe(2);
    expect(matriz.versions[1].snapshot).toMatchObject({ vigente: false });
  });

  it("falla entera si una referencia no existe para ningun rol de la fila", async () => {
    const resultado = await importar([
      fila({ fila: 2, fichero: MATRIZ, formato: "xlsx", referencias: [] }),
      fila({ fila: 3, referencias: [{ norma: SYNTHETIC_NORMA, item: "9.9" }] }),
    ]);

    expect(resultado).toEqual({
      ok: false,
      errors: [
        `Fila 3: el requisito ${SYNTHETIC_NORMA}/9.9 no existe para ningún rol de la fila (adjudicador, adjudicatario_principal).`,
      ],
    });
    expect(await sinteticas()).toEqual([]);
  });

  it("falla si el fichero no esta en el directorio de plantillas", async () => {
    const resultado = await importar([fila({ fichero: "SYNTHETIC-svc-no-existe.docx" })]);

    expect(resultado).toEqual({
      ok: false,
      errors: ["Fila 2: el fichero «SYNTHETIC-svc-no-existe.docx» no está en docs/fuentes/plantillas-iso/."],
    });
    expect(await sinteticas()).toEqual([]);
  });

  it("borrar un requisito vinculado lo impide la FK (Restrict)", async () => {
    await importar([fila()]);
    await expect(
      prisma.requirementTemplate.delete({ where: { id: req.adjudicador11 } })
    ).rejects.toMatchObject({ code: "P2003" });
  });
});
```

- [ ] **Step 4: Verificar que falla**

Run: `npx vitest run tests/services/document-template.service.test.ts`
Expected: FAIL, `Failed to resolve import "@/services/document-template.service"`.

- [ ] **Step 5: Implementar la importación**

`services/document-template.service.ts`:

```typescript
import { readdir } from "fs/promises";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { getPlantillasDir } from "@/services/document-template.paths";
import {
  PROJECT_ROLES,
  type DocumentTemplateImportSummary,
  type ParsedDocumentTemplateRow,
} from "@/services/document-template.types";

// Catalogo documental (ADR-016). Ninguna funcion de este modulo borra una
// DocumentTemplate: retirar es vigente = false (invariante 1 del domain model).

type Deseado = {
  fichero: string;
  nombre: string;
  formato: string;
  vigente: boolean;
  roles: string[];
  fase: string;
  obligatoria: boolean;
  tipo: string;
  requirementTemplateIds: string[];
};

type ImportOptions = {
  dir?: string;
  // Solo para tests: limita la retirada a las plantillas con este prefijo, para no
  // tocar el catalogo real de la rama Test. En produccion el ambito es todo el catalogo.
  ficheroPrefix?: string;
};

// La importacion de 23 filas son ~100 consultas: el limite por defecto de 5 s de las
// transacciones interactivas se queda corto contra Neon.
const IMPORT_TRANSACTION = { timeout: 60_000, maxWait: 10_000 } as const;

export async function importDocumentTemplates(
  rows: ParsedDocumentTemplateRow[],
  actorId: string,
  options: ImportOptions = {}
): Promise<
  { ok: true; summary: DocumentTemplateImportSummary } | { ok: false; errors: string[] }
> {
  const dir = options.dir ?? getPlantillasDir();
  const errors: string[] = [];

  // Se compara en NFC y se guarda el nombre real en disco: las tildes pueden venir
  // compuestas de forma distinta en el Excel y en el sistema de ficheros.
  const enDisco = new Map((await readdir(dir)).map((n) => [n.normalize("NFC"), n]));

  const catalogo = await prisma.requirementTemplate.findMany({
    where: { role: { in: [...PROJECT_ROLES] } },
    select: { id: true, norma: true, item: true, role: true },
  });

  const deseados: Deseado[] = [];
  for (const row of rows) {
    const real = enDisco.get(row.fichero.normalize("NFC"));
    if (!real) {
      errors.push(`Fila ${row.fila}: el fichero «${row.fichero}» no está en docs/fuentes/plantillas-iso/.`);
    }

    const ids = new Set<string>();
    for (const ref of row.referencias) {
      const encontrados = catalogo.filter(
        (r) =>
          r.norma === ref.norma &&
          r.item === ref.item &&
          (row.roles as readonly string[]).includes(r.role)
      );
      if (encontrados.length === 0) {
        errors.push(
          `Fila ${row.fila}: el requisito ${ref.norma}/${ref.item} no existe para ningún rol de la fila (${row.roles.join(", ")}).`
        );
      }
      for (const r of encontrados) ids.add(r.id);
    }

    deseados.push({
      fichero: real ?? row.fichero,
      nombre: row.nombre,
      formato: row.formato,
      vigente: row.vigente,
      roles: [...row.roles],
      fase: row.fase,
      obligatoria: row.obligatoria,
      tipo: row.tipo,
      requirementTemplateIds: [...ids].sort(),
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  const summary = await prisma.$transaction(
    (tx) => escribirCatalogo(tx, deseados, actorId, options.ficheroPrefix ?? ""),
    IMPORT_TRANSACTION
  );
  return { ok: true, summary };
}

async function escribirCatalogo(
  tx: Prisma.TransactionClient,
  deseados: Deseado[],
  actorId: string,
  ficheroPrefix: string
): Promise<DocumentTemplateImportSummary> {
  const existentes = await tx.documentTemplate.findMany({
    where: { fichero: { startsWith: ficheroPrefix } },
    include: { requirementLinks: { select: { requirementTemplateId: true } } },
  });
  const porFichero = new Map(existentes.map((t) => [t.fichero, t]));
  const resumen: DocumentTemplateImportSummary = {
    total: deseados.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    retired: 0,
    links: 0,
  };

  for (const d of deseados) {
    resumen.links += d.requirementTemplateIds.length;
    const actual = porFichero.get(d.fichero);
    const vinculos = {
      create: d.requirementTemplateIds.map((requirementTemplateId) => ({ requirementTemplateId })),
    };

    if (!actual) {
      const creada = await tx.documentTemplate.create({
        data: { ...campos(d), version: 1, createdBy: actorId, requirementLinks: vinculos },
      });
      await tx.documentTemplateVersion.create({
        data: { documentTemplateId: creada.id, version: 1, snapshot: snapshot(d), importedBy: actorId },
      });
      resumen.created += 1;
      continue;
    }

    const vinculadosAhora = actual.requirementLinks.map((l) => l.requirementTemplateId).sort();
    if (mismoEstado({ ...actual, requirementTemplateIds: vinculadosAhora }, d)) {
      resumen.unchanged += 1;
      continue;
    }

    const version = actual.version + 1;
    await tx.documentTemplateRequirement.deleteMany({ where: { documentTemplateId: actual.id } });
    await tx.documentTemplate.update({
      where: { id: actual.id },
      data: { ...campos(d), version, updatedBy: actorId, requirementLinks: vinculos },
    });
    await tx.documentTemplateVersion.create({
      data: { documentTemplateId: actual.id, version, snapshot: snapshot(d), importedBy: actorId },
    });
    resumen.updated += 1;
  }

  const enLibro = new Set(deseados.map((d) => d.fichero));
  for (const t of existentes) {
    if (enLibro.has(t.fichero) || !t.vigente) continue;
    const version = t.version + 1;
    const retirada: Deseado = {
      ...campos(t),
      fichero: t.fichero,
      vigente: false,
      requirementTemplateIds: t.requirementLinks.map((l) => l.requirementTemplateId).sort(),
    };
    await tx.documentTemplate.update({
      where: { id: t.id },
      data: { vigente: false, version, updatedBy: actorId },
    });
    await tx.documentTemplateVersion.create({
      data: { documentTemplateId: t.id, version, snapshot: snapshot(retirada), importedBy: actorId },
    });
    resumen.retired += 1;
  }

  return resumen;
}

function campos(d: Omit<Deseado, "requirementTemplateIds">) {
  return {
    fichero: d.fichero,
    nombre: d.nombre,
    formato: d.formato,
    vigente: d.vigente,
    roles: d.roles,
    fase: d.fase,
    obligatoria: d.obligatoria,
    tipo: d.tipo,
  };
}

function snapshot(d: Deseado): Prisma.InputJsonObject {
  return { ...campos(d), requirementTemplateIds: d.requirementTemplateIds };
}

function mismoEstado(a: Deseado, b: Deseado) {
  return (
    a.nombre === b.nombre &&
    a.formato === b.formato &&
    a.vigente === b.vigente &&
    a.fase === b.fase &&
    a.obligatoria === b.obligatoria &&
    a.tipo === b.tipo &&
    mismaLista(a.roles, b.roles) &&
    mismaLista(a.requirementTemplateIds, b.requirementTemplateIds)
  );
}

function mismaLista(a: string[], b: string[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
```

- [ ] **Step 6: Verificar que pasa**

Run: `npx vitest run tests/services/document-template.service.test.ts`
Expected: PASS (7 tests). Si falla a mitad: `node scripts/clean-test-tenants.mjs --apply` tras la Task 7, o borrar a mano con los helpers.

- [ ] **Step 7: Commit**

```bash
git add services/document-template.paths.ts services/document-template.service.ts tests/helpers/document-templates.ts tests/services/document-template.service.test.ts
git commit -m "feat: importacion del catalogo documental, todo o nada y versionada"
```

---

### Task 4: Listado aplicable y resolución del fichero (servicio)

**Files:**
- Modify: `services/document-template.service.ts` (añadir al final)
- Test: `tests/services/document-template.service.test.ts` (añadir un `describe`)

**Interfaces:**
- Consumes: `DocumentTemplateActor`, `ProjectDocumentTemplate`, `FASES_ORDEN` (Task 2); helpers de Task 3.
- Produces:
  - `listApplicableTemplates(projectId: string, actor: DocumentTemplateActor): Promise<{ notFound: true } | { projectRole: string; templates: ProjectDocumentTemplate[] }>`
  - `resolveTemplateFile(projectId: string, templateId: string, actor: DocumentTemplateActor, dir?: string): Promise<{ notFound: true } | { missing: true; fichero: string } | { ruta: string; fichero: string; formato: string; size: number }>`

- [ ] **Step 1: Añadir los tests (fallan)**

Al final de `tests/services/document-template.service.test.ts`, añadir a los imports `listApplicableTemplates, resolveTemplateFile` desde el servicio y `createSyntheticDocumentTemplate` desde los helpers, y este bloque:

```typescript
describe("listApplicableTemplates y resolveTemplateFile", () => {
  let ajeno: Awaited<ReturnType<typeof createTenant>>;
  let proyectoId: string;
  let ids: Record<string, string>;

  beforeAll(async () => {
    ajeno = await createTenant("doc-templates-svc-ajeno");
    proyectoId = (
      await prisma.project.create({
        data: { name: "SYNTHETIC proyecto", role: "adjudicatario", userId: tenant.user.id, companyId: tenant.company.id },
      })
    ).id;
  });

  beforeEach(async () => {
    await cleanupSyntheticDocumentTemplates();
    const crear = (o: Parameters<typeof createSyntheticDocumentTemplate>[1]) =>
      createSyntheticDocumentTemplate(tenant.admin.id, o).then((t) => t.id);
    ids = {
      cierre: await crear({ fichero: "SYNTHETIC-svc-Z-cierre.docx", nombre: "SYNTHETIC A cierre", fase: "cierre" }),
      ofertaB: await crear({ fichero: ACTA, nombre: "SYNTHETIC B oferta", fase: "oferta" }),
      ofertaA: await crear({ fichero: MATRIZ, nombre: "SYNTHETIC A oferta", fase: "oferta", formato: "xlsx" }),
      otroRol: await crear({ fichero: "SYNTHETIC-svc-otro-rol.docx", roles: ["adjudicador"] }),
      retirada: await crear({ fichero: "SYNTHETIC-svc-retirada.docx", vigente: false }),
      // Empieza por SYNTHETIC- para que la limpieza la borre, y resuelve fuera del directorio.
      maliciosa: await crear({ fichero: "SYNTHETIC-svc-x/../../fuera.docx", nombre: "SYNTHETIC C oferta fuera" }),
    };
  });

  afterAll(async () => {
    await cleanupSyntheticDocumentTemplates();
    await cleanupTenant(ajeno.company.id);
  });

  const dueno = () => ({ userId: tenant.user.id, isAdmin: false });

  it("lista solo vigentes del rol, por fase y nombre, sin el fichero", async () => {
    const resultado = await listApplicableTemplates(proyectoId, dueno());
    if ("notFound" in resultado) throw new Error("proyecto no encontrado");

    expect(resultado.projectRole).toBe("adjudicatario");
    // La maliciosa es vigente, del rol y de oferta: el listado la muestra porque no lee
    // disco; la descarga es la que la corta.
    const sinteticasListadas = resultado.templates.filter((t) => t.nombre.startsWith("SYNTHETIC"));
    expect(sinteticasListadas.map((t) => t.nombre)).toEqual([
      "SYNTHETIC A oferta",
      "SYNTHETIC B oferta",
      "SYNTHETIC C oferta fuera",
      "SYNTHETIC A cierre",
    ]);
    expect(resultado.templates.map((t) => t.id)).not.toContain(ids.otroRol);
    expect(resultado.templates.map((t) => t.id)).not.toContain(ids.retirada);
    expect(Object.keys(resultado.templates[0]).sort()).toEqual(
      ["fase", "formato", "id", "nombre", "obligatoria", "tipo"]
    );
  });

  it("proyecto ajeno es notFound; un admin lo ve", async () => {
    expect(await listApplicableTemplates(proyectoId, { userId: ajeno.user.id, isAdmin: false })).toEqual({ notFound: true });
    expect(await listApplicableTemplates(proyectoId, { userId: ajeno.admin.id, isAdmin: true })).toMatchObject({
      projectRole: "adjudicatario",
    });
  });

  it("resuelve el fichero aplicable con su tamano", async () => {
    const r = await resolveTemplateFile(proyectoId, ids.ofertaB, dueno(), dir);
    expect(r).toMatchObject({ fichero: ACTA, formato: "docx", size: `SYNTHETIC TEST DATA ${ACTA}`.length });
  });

  it.each(["otroRol", "retirada", "maliciosa"])("%s es notFound", async (clave) => {
    expect(await resolveTemplateFile(proyectoId, ids[clave], dueno(), dir)).toEqual({ notFound: true });
  });

  it("plantilla inexistente y proyecto ajeno son notFound", async () => {
    expect(await resolveTemplateFile(proyectoId, "no-existe", dueno(), dir)).toEqual({ notFound: true });
    expect(
      await resolveTemplateFile(proyectoId, ids.ofertaB, { userId: ajeno.user.id, isAdmin: false }, dir)
    ).toEqual({ notFound: true });
  });

  it("binario ausente es missing", async () => {
    expect(await resolveTemplateFile(proyectoId, ids.cierre, dueno(), dir)).toEqual({
      missing: true,
      fichero: "SYNTHETIC-svc-Z-cierre.docx",
    });
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run tests/services/document-template.service.test.ts`
Expected: FAIL, `listApplicableTemplates is not a function` (o error de import).

- [ ] **Step 3: Implementar**

Añadir al principio de `services/document-template.service.ts`:

```typescript
import { stat } from "fs/promises";
import path from "path";
```

y añadir `FASES_ORDEN`, `type DocumentTemplateActor`, `type ProjectDocumentTemplate` al import de tipos. Al final del fichero:

```typescript
// Mismo criterio que findProjectForActor de evidence.service.ts (dueno o admin), pero
// necesita el rol del proyecto.
async function findProjectForActor(projectId: string, actor: DocumentTemplateActor) {
  return prisma.project.findFirst({
    where: { id: projectId, ...(actor.isAdmin ? {} : { userId: actor.userId }) },
    select: { id: true, role: true },
  });
}

// Invariante 8: aplicable = vigente y Project.role en roles.
const aplicableA = (role: string) => ({ vigente: true, roles: { has: role } });

export async function listApplicableTemplates(
  projectId: string,
  actor: DocumentTemplateActor
): Promise<{ notFound: true } | { projectRole: string; templates: ProjectDocumentTemplate[] }> {
  const project = await findProjectForActor(projectId, actor);
  if (!project) return { notFound: true };

  const templates = await prisma.documentTemplate.findMany({
    where: aplicableA(project.role),
    select: { id: true, nombre: true, formato: true, fase: true, obligatoria: true, tipo: true },
  });

  const indiceFase = (fase: string) => {
    const i = (FASES_ORDEN as readonly string[]).indexOf(fase);
    return i === -1 ? FASES_ORDEN.length : i;
  };
  templates.sort(
    (a, b) => indiceFase(a.fase) - indiceFase(b.fase) || a.nombre.localeCompare(b.nombre, "es")
  );

  return { projectRole: project.role, templates };
}

export async function resolveTemplateFile(
  projectId: string,
  templateId: string,
  actor: DocumentTemplateActor,
  dir: string = getPlantillasDir()
): Promise<
  | { notFound: true }
  | { missing: true; fichero: string }
  | { ruta: string; fichero: string; formato: string; size: number }
> {
  // Primero el proyecto: una plantilla valida no confirma que exista un proyecto ajeno.
  const project = await findProjectForActor(projectId, actor);
  if (!project) return { notFound: true };

  const plantilla = await prisma.documentTemplate.findFirst({
    where: { id: templateId, ...aplicableA(project.role) },
    select: { fichero: true, formato: true },
  });
  if (!plantilla) return { notFound: true };

  // Segundo cierre del recorrido de rutas (el primero es el parser).
  const base = path.resolve(dir);
  const ruta = path.resolve(base, plantilla.fichero);
  if (!ruta.startsWith(base + path.sep)) {
    console.error("plantilla con fichero fuera del directorio de plantillas", { templateId });
    return { notFound: true };
  }

  try {
    const info = await stat(ruta);
    if (!info.isFile()) return { missing: true, fichero: plantilla.fichero };
    return { ruta, fichero: plantilla.fichero, formato: plantilla.formato, size: info.size };
  } catch {
    return { missing: true, fichero: plantilla.fichero };
  }
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx vitest run tests/services/document-template.service.test.ts`
Expected: PASS (7 + 8 tests).

- [ ] **Step 5: Commit**

```bash
git add services/document-template.service.ts tests/services/document-template.service.test.ts
git commit -m "feat: listado aplicable y resolucion segura del fichero de plantilla"
```

---

### Task 5: Rutas de listado y descarga

**Files:**
- Create: `app/lib/contentDisposition.ts`
- Create: `app/api/projects/[id]/document-templates/route.ts`
- Create: `app/api/projects/[id]/document-templates/[templateId]/file/route.ts`
- Test: `tests/lib/contentDisposition.test.ts`, `tests/api/document-templates.test.ts`

**Interfaces:**
- Consumes: `listApplicableTemplates`, `resolveTemplateFile` (Task 4); `getPlantillasDir` (Task 3, se mockea en el test).
- Produces: `contentDisposition(fichero: string): string`; `GET` en ambas rutas.

- [ ] **Step 0: Leer la guía de route handlers de esta versión de Next**

Leer `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` (o el fichero equivalente bajo `01-app/03-api-reference/03-file-conventions/`): firma de `params` (Promise) y respuestas con `ReadableStream`. Si algo contradice este plan, parar y avisar.

- [ ] **Step 1: Test de la cabecera (falla)**

`tests/lib/contentDisposition.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { contentDisposition } from "@/app/lib/contentDisposition";

describe("contentDisposition", () => {
  it("da un filename ASCII y el nombre real en filename*", () => {
    expect(contentDisposition("PLANTILLA-Acta Aprobación Información (1).docx")).toBe(
      "attachment; filename=\"PLANTILLA-Acta Aprobacion Informacion (1).docx\"; " +
        "filename*=UTF-8''PLANTILLA-Acta%20Aprobaci%C3%B3n%20Informaci%C3%B3n%20%281%29.docx"
    );
  });

  it("neutraliza comillas, barras y saltos de linea", () => {
    const valor = contentDisposition('a"b\\c\r\nd.docx');
    expect(valor.startsWith('attachment; filename="a_b_c__d.docx"; ')).toBe(true);
    expect(valor).not.toMatch(/[\r\n]/);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run tests/lib/contentDisposition.test.ts`
Expected: FAIL, no resuelve el import.

- [ ] **Step 3: Implementar**

`app/lib/contentDisposition.ts`:

```typescript
// Content-Disposition seguro (security-spec): ASCII sin comillas, barras ni controles en
// `filename`, y el nombre real en `filename*` (RFC 5987, que no admite ' ( ) * sin codificar).
export function contentDisposition(fichero: string) {
  const ascii = fichero
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]|["\\]/g, "_");
  const codificado = encodeURIComponent(fichero).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${codificado}`;
}
```

Run: `npx vitest run tests/lib/contentDisposition.test.ts` → PASS (2 tests).

- [ ] **Step 4: Test de las rutas (falla)**

`tests/api/document-templates.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { rm } from "fs/promises";
import { prisma } from "@/app/lib/prisma";

// El directorio real no se toca: las rutas leen de uno temporal con ficheros SYNTHETIC.
const plantillas = vi.hoisted(() => ({ dir: "" }));
vi.mock("@/services/document-template.paths", () => ({
  getPlantillasDir: () => plantillas.dir,
}));

import { GET as LIST } from "@/app/api/projects/[id]/document-templates/route";
import { GET as FILE } from "@/app/api/projects/[id]/document-templates/[templateId]/file/route";
import { cleanupTenant, createTenant } from "../helpers/db";
import { makeRequest, sessionCookie } from "../helpers/auth";
import {
  cleanupSyntheticDocumentTemplates,
  createSyntheticDocumentTemplate,
  createSyntheticTemplatesDir,
} from "../helpers/document-templates";

const ACTA = "SYNTHETIC-api-Acta Aprobación.docx";
const MATRIZ = "SYNTHETIC-api-Matriz.xlsx";

let a: Awaited<ReturnType<typeof createTenant>>;
let b: Awaited<ReturnType<typeof createTenant>>;
let proyectoId: string;
let ids: Record<string, string>;

const listCtx = (id: string) => ({ params: Promise.resolve({ id }) });
const fileCtx = (id: string, templateId: string) => ({ params: Promise.resolve({ id, templateId }) });
const urlFichero = (id: string, templateId: string) =>
  `/api/projects/${id}/document-templates/${templateId}/file`;

beforeAll(async () => {
  a = await createTenant("doc-templates-api-a");
  b = await createTenant("doc-templates-api-b");
  plantillas.dir = await createSyntheticTemplatesDir([ACTA, MATRIZ]);
  await cleanupSyntheticDocumentTemplates();
  proyectoId = (
    await prisma.project.create({
      data: { name: "SYNTHETIC proyecto", role: "adjudicatario", userId: a.user.id, companyId: a.company.id },
    })
  ).id;
  const crear = (o: Parameters<typeof createSyntheticDocumentTemplate>[1]) =>
    createSyntheticDocumentTemplate(a.admin.id, o).then((t) => t.id);
  ids = {
    acta: await crear({ fichero: ACTA }),
    matriz: await crear({ fichero: MATRIZ, formato: "xlsx" }),
    otroRol: await crear({ fichero: "SYNTHETIC-api-otro-rol.docx", roles: ["adjudicador"] }),
    retirada: await crear({ fichero: "SYNTHETIC-api-retirada.docx", vigente: false }),
    sinBinario: await crear({ fichero: "SYNTHETIC-api-sin-binario.docx" }),
  };
});

afterAll(async () => {
  await cleanupSyntheticDocumentTemplates();
  await cleanupTenant(a.company.id);
  await cleanupTenant(b.company.id);
  await rm(plantillas.dir, { recursive: true, force: true });
});

describe("GET /api/projects/[id]/document-templates", () => {
  it("401 sin sesion", async () => {
    const res = await LIST(makeRequest(`/api/projects/${proyectoId}/document-templates`), listCtx(proyectoId));
    expect(res.status).toBe(401);
  });

  it("200 al dueno, con las aplicables y sin el fichero", async () => {
    const res = await LIST(
      makeRequest(`/api/projects/${proyectoId}/document-templates`, { cookie: sessionCookie(a.user) }),
      listCtx(proyectoId)
    );
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.projectRole).toBe("adjudicatario");
    const listados = data.templates.map((t: { id: string }) => t.id);
    expect(listados).toEqual(expect.arrayContaining([ids.acta, ids.matriz, ids.sinBinario]));
    expect(listados).not.toContain(ids.otroRol);
    expect(listados).not.toContain(ids.retirada);
    // El nombre por defecto del helper incluye el fichero: se comprueba la clave, no el texto.
    expect(data.templates.some((t: object) => "fichero" in t)).toBe(false);
  });

  it("404 a otro usuario; 200 a un admin", async () => {
    const ajeno = await LIST(
      makeRequest(`/api/projects/${proyectoId}/document-templates`, { cookie: sessionCookie(b.user) }),
      listCtx(proyectoId)
    );
    expect(ajeno.status).toBe(404);
    expect(await ajeno.json()).toEqual({ error: "Proyecto no encontrado." });

    const admin = await LIST(
      makeRequest(`/api/projects/${proyectoId}/document-templates`, { cookie: sessionCookie(b.admin) }),
      listCtx(proyectoId)
    );
    expect(admin.status).toBe(200);
  });
});

describe("GET /api/projects/[id]/document-templates/[templateId]/file", () => {
  it("401 sin sesion", async () => {
    const res = await FILE(makeRequest(urlFichero(proyectoId, ids.acta)), fileCtx(proyectoId, ids.acta));
    expect(res.status).toBe(401);
  });

  it("200 con el binario y las cabeceras del contrato", async () => {
    const res = await FILE(
      makeRequest(urlFichero(proyectoId, ids.acta), { cookie: sessionCookie(a.user) }),
      fileCtx(proyectoId, ids.acta)
    );
    expect(res.status).toBe(200);
    const contenido = `SYNTHETIC TEST DATA ${ACTA}`;
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(res.headers.get("Content-Disposition")).toContain("attachment; filename=\"SYNTHETIC-api-Acta Aprobacion.docx\"");
    expect(res.headers.get("Content-Length")).toBe(String(Buffer.byteLength(contenido)));
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await res.text()).toBe(contenido);
  });

  it("xlsx lleva su Content-Type", async () => {
    const res = await FILE(
      makeRequest(urlFichero(proyectoId, ids.matriz), { cookie: sessionCookie(a.user) }),
      fileCtx(proyectoId, ids.matriz)
    );
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });

  it("404 identico para ajeno, otro rol, retirada e inexistente", async () => {
    const casos: [string, string, string][] = [
      [sessionCookie(b.user), proyectoId, ids.acta],
      [sessionCookie(a.user), proyectoId, ids.otroRol],
      [sessionCookie(a.user), proyectoId, ids.retirada],
      [sessionCookie(a.user), proyectoId, "no-existe"],
      [sessionCookie(a.user), "proyecto-inexistente", ids.acta],
    ];
    for (const [cookie, id, templateId] of casos) {
      const res = await FILE(makeRequest(urlFichero(id, templateId), { cookie }), fileCtx(id, templateId));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Plantilla no encontrada." });
    }
  });

  it("500 si el binario no esta desplegado", async () => {
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await FILE(
      makeRequest(urlFichero(proyectoId, ids.sinBinario), { cookie: sessionCookie(a.user) }),
      fileCtx(proyectoId, ids.sinBinario)
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "No se pudo descargar la plantilla." });
    expect(espia.mock.calls[0][0]).toBe("plantilla en catalogo sin binario desplegado");
    espia.mockRestore();
  });
});
```

- [ ] **Step 5: Verificar que falla**

Run: `npx vitest run tests/api/document-templates.test.ts`
Expected: FAIL, no resuelven los imports de las rutas.

- [ ] **Step 6: Implementar el listado**

`app/api/projects/[id]/document-templates/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { listApplicableTemplates } from "@/services/document-template.service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();

    const { id: projectId } = await context.params;
    const result = await listApplicableTemplates(projectId, {
      userId: user.id,
      isAdmin: isAdminRole(user.role),
    });

    if ("notFound" in result) {
      return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("ERROR GET /api/projects/[id]/document-templates:", error);
    return NextResponse.json(
      { error: "No se pudo cargar la documentación del proyecto." },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 7: Implementar la descarga**

`app/api/projects/[id]/document-templates/[templateId]/file/route.ts`:

```typescript
import { createReadStream } from "fs";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { getAuthSession, isAdminRole, unauthorized } from "@/app/lib/auth";
import { contentDisposition } from "@/app/lib/contentDisposition";
import { resolveTemplateFile } from "@/services/document-template.service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; templateId: string }> };

// Fijado por formato, nunca deducido del fichero (security-spec).
const CONTENT_TYPES: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export async function GET(req: Request, context: RouteContext) {
  try {
    const user = await getAuthSession(req);
    if (!user) return unauthorized();

    const { id: projectId, templateId } = await context.params;
    const result = await resolveTemplateFile(projectId, templateId, {
      userId: user.id,
      isAdmin: isAdminRole(user.role),
    });

    // Un solo cuerpo para todas las causas: no revela si existe el proyecto o la plantilla.
    if ("notFound" in result) {
      return NextResponse.json({ error: "Plantilla no encontrada." }, { status: 404 });
    }

    if ("missing" in result) {
      console.error("plantilla en catalogo sin binario desplegado", {
        projectId,
        templateId,
        fichero: result.fichero,
      });
      return NextResponse.json({ error: "No se pudo descargar la plantilla." }, { status: 500 });
    }

    const cuerpo = Readable.toWeb(createReadStream(result.ruta)) as ReadableStream<Uint8Array>;
    return new Response(cuerpo, {
      status: 200,
      headers: {
        "Content-Type": CONTENT_TYPES[result.formato] ?? "application/octet-stream",
        "Content-Disposition": contentDisposition(result.fichero),
        "Content-Length": String(result.size),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("ERROR GET /api/projects/[id]/document-templates/[templateId]/file:", error);
    return NextResponse.json({ error: "No se pudo descargar la plantilla." }, { status: 500 });
  }
}
```

- [ ] **Step 8: Verificar que pasa**

Run: `npx vitest run tests/api/document-templates.test.ts tests/lib/contentDisposition.test.ts`
Expected: PASS (8 + 2 tests).

- [ ] **Step 9: Commit**

```bash
git add app/lib/contentDisposition.ts "app/api/projects/[id]/document-templates" tests/lib/contentDisposition.test.ts tests/api/document-templates.test.ts
git commit -m "feat: rutas de listado y descarga de plantillas documentales por proyecto"
```

---

### Task 6: Ruta de importación admin y 409 en `/api/import`

**Files:**
- Create: `app/lib/prismaErrors.ts`
- Create: `app/api/admin/document-templates/import/route.ts`
- Modify: `app/api/import/route.ts` (bloque `if (replaceExisting)`)
- Test: `tests/api/document-templates-import.test.ts`

**Interfaces:**
- Consumes: `parseDocumentTemplateWorkbook` (Task 2), `importDocumentTemplates` (Task 3), `readSafeXlsxUpload`.
- Produces: `isForeignKeyError(error: unknown): boolean`; `POST` admin.

- [ ] **Step 1: Escribir el test (falla)**

`tests/api/document-templates-import.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import ExcelJS from "exceljs";
import { prisma } from "@/app/lib/prisma";
import { POST as IMPORT_CATALOGO } from "@/app/api/admin/document-templates/import/route";
import { POST as IMPORT_REQUISITOS } from "@/app/api/import/route";
import { BLOCKED_ACCOUNT_MESSAGE } from "@/app/lib/auth";
import { cleanupTenant, createTenant } from "../helpers/db";
import { sessionCookie } from "../helpers/auth";
import { SYNTHETIC_PREFIX, cleanupSyntheticDocumentTemplates } from "../helpers/document-templates";

let t: Awaited<ReturnType<typeof createTenant>>;

async function libro(nombreHoja: string, filas: string[][]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(nombreHoja);
  for (const fila of filas) sheet.addRow(fila);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function peticion(url: string, cookie: string | null, fichero?: { contenido: Buffer; nombre: string }, extra: Record<string, string> = {}) {
  const datos = new FormData();
  if (fichero) datos.append("file", new File([fichero.contenido], fichero.nombre));
  for (const [k, v] of Object.entries(extra)) datos.append(k, v);
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: cookie ? { Cookie: cookie } : {},
    body: datos,
  });
}

const URL_CATALOGO = "/api/admin/document-templates/import";

beforeAll(async () => {
  t = await createTenant("doc-templates-import");
  await cleanupSyntheticDocumentTemplates();
});

afterAll(async () => {
  await cleanupSyntheticDocumentTemplates();
  await cleanupTenant(t.company.id);
});

describe("POST /api/admin/document-templates/import", () => {
  it("401 sin sesion", async () => {
    expect((await IMPORT_CATALOGO(peticion(URL_CATALOGO, null))).status).toBe(401);
  });

  it("403 a un usuario no admin", async () => {
    expect((await IMPORT_CATALOGO(peticion(URL_CATALOGO, sessionCookie(t.user)))).status).toBe(403);
  });

  it("403 con el mensaje de cuenta bloqueada", async () => {
    await prisma.user.update({ where: { id: t.admin.id }, data: { status: "blocked" } });
    try {
      const res = await IMPORT_CATALOGO(peticion(URL_CATALOGO, sessionCookie(t.admin)));
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: BLOCKED_ACCOUNT_MESSAGE });
    } finally {
      await prisma.user.update({ where: { id: t.admin.id }, data: { status: "active" } });
    }
  });

  it("400 sin fichero y con un fichero que no es xlsx", async () => {
    expect((await IMPORT_CATALOGO(peticion(URL_CATALOGO, sessionCookie(t.admin)))).status).toBe(400);
    const res = await IMPORT_CATALOGO(
      peticion(URL_CATALOGO, sessionCookie(t.admin), { contenido: Buffer.from("hola"), nombre: "libro.csv" })
    );
    expect(res.status).toBe(400);
  });

  it("400 con los errores por fila y sin escribir nada", async () => {
    // SYNTHETIC TEST DATA: el fichero no existe en docs/fuentes/plantillas-iso/.
    const contenido = await libro("Plantillas", [
      ["Fichero", "Formato", "Nombre", "Vigente", "Rol", "Fase", "Obligatoria", "Tipo", "Requisitos que justifica"],
      ["SYNTHETIC-import-no-existe.docx", "docx", "SYNTHETIC TEST DATA", "sí", "adjudicador", "oferta", "sí", "iso", ""],
    ]);
    const res = await IMPORT_CATALOGO(
      peticion(URL_CATALOGO, sessionCookie(t.admin), { contenido, nombre: "plantillas_documentales.xlsx" })
    );
    expect(res.status).toBe(400);
    const cuerpo = await res.json();
    expect(cuerpo.error).toBe("El libro tiene errores.");
    expect(cuerpo.details).toEqual([
      "Fila 2: el fichero «SYNTHETIC-import-no-existe.docx» no está en docs/fuentes/plantillas-iso/.",
    ]);
    expect(await prisma.documentTemplate.count({ where: { fichero: { startsWith: SYNTHETIC_PREFIX } } })).toBe(0);
  });
});

describe("POST /api/import con replace=true", () => {
  // No se borra el catalogo real de Test: se simula el P2003 que la FK Restrict
  // provoca de verdad (lo prueba tests/services/document-template.service.test.ts).
  async function libroRequisitos() {
    return libro("Hoja1", [
      ["norma", "item", "requerimiento", "evidencia", "estado", "fecha_limite"],
      ["SYNTHETIC-19650-9", "1.1", "SYNTHETIC TEST DATA", "", "total", ""],
    ]);
  }

  it("409 si hay plantillas documentales vinculadas, sin crear nada", async () => {
    const borrar = vi
      .spyOn(prisma.requirementTemplate, "deleteMany")
      .mockRejectedValueOnce(Object.assign(new Error("FK"), { code: "P2003" }));
    const crear = vi.spyOn(prisma.requirementTemplate, "createMany");
    try {
      const res = await IMPORT_REQUISITOS(
        peticion("/api/import", sessionCookie(t.admin), { contenido: await libroRequisitos(), nombre: "req.xlsx" }, { replace: "true" })
      );
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({
        error:
          "No se puede reemplazar el catálogo de requisitos: hay plantillas documentales que justifican algunos de ellos.",
      });
      expect(crear).not.toHaveBeenCalled();
    } finally {
      borrar.mockRestore();
      crear.mockRestore();
    }
  });

  it("otro error sigue siendo 500", async () => {
    const borrar = vi
      .spyOn(prisma.requirementTemplate, "deleteMany")
      .mockRejectedValueOnce(new Error("caida"));
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await IMPORT_REQUISITOS(
        peticion("/api/import", sessionCookie(t.admin), { contenido: await libroRequisitos(), nombre: "req.xlsx" }, { replace: "true" })
      );
      expect(res.status).toBe(500);
    } finally {
      borrar.mockRestore();
      espia.mockRestore();
    }
  });
});
```

Si el parser de `/api/import` rechaza la fila del libro de requisitos (columna `estado` o formato), leer `docs/excel-import-format.md` y ajustar **solo la fila sintética** hasta que la ruta llegue al `deleteMany`. No tocar el parser.

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run tests/api/document-templates-import.test.ts`
Expected: FAIL, no resuelve `@/app/api/admin/document-templates/import/route`.

- [ ] **Step 3: Implementar el helper de errores**

`app/lib/prismaErrors.ts`:

```typescript
// P2003: violacion de clave foranea (p. ej. onDelete: Restrict).
export function isForeignKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2003"
  );
}
```

- [ ] **Step 4: Implementar la ruta admin**

`app/api/admin/document-templates/import/route.ts`:

```typescript
import { NextResponse } from "next/server";
import {
  BLOCKED_ACCOUNT_MESSAGE,
  forbidden,
  getAuthSession,
  isAdminRole,
  isBlockedStatus,
  unauthorized,
} from "@/app/lib/auth";
import { readSafeXlsxUpload } from "@/app/lib/excelUpload";
import { parseDocumentTemplateWorkbook } from "@/app/lib/documentTemplateImport";
import { importDocumentTemplates } from "@/services/document-template.service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await getAuthSession(req, { allowBlocked: true });
    if (!user) return unauthorized();
    if (isBlockedStatus(user.status)) return forbidden(BLOCKED_ACCOUNT_MESSAGE);
    if (!isAdminRole(user.role)) {
      return forbidden("Solo el administrador puede importar el catálogo documental.");
    }

    const formData = await req.formData().catch(() => null);
    const file = formData?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Debes subir un archivo .xlsx." }, { status: 400 });
    }

    const upload = await readSafeXlsxUpload(file);
    if (!upload.ok) return NextResponse.json({ error: upload.error }, { status: 400 });

    const parsed = await parseDocumentTemplateWorkbook(upload.buffer);
    if (parsed.errors.length > 0) {
      return NextResponse.json(
        { error: "El libro tiene errores.", details: parsed.errors },
        { status: 400 }
      );
    }

    // El actor sale de la sesion; el cuerpo no acepta actores (security-spec).
    const result = await importDocumentTemplates(parsed.rows, user.id);
    if (!result.ok) {
      return NextResponse.json(
        { error: "El libro tiene errores.", details: result.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: result.summary });
  } catch (error) {
    console.error("ERROR POST /api/admin/document-templates/import:", error);
    return NextResponse.json(
      { error: "No se pudo importar el catálogo documental." },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 5: Añadir el 409 a `/api/import`**

En `app/api/import/route.ts`, añadir el import:

```typescript
import { isForeignKeyError } from "@/app/lib/prismaErrors";
```

y sustituir:

```typescript
    if (replaceExisting) {
      await prisma.requirementTemplate.deleteMany();
    }
```

por:

```typescript
    if (replaceExisting) {
      try {
        await prisma.requirementTemplate.deleteMany();
      } catch (error) {
        // DocumentTemplateRequirement es Restrict hacia RequirementTemplate (domain model,
        // decision del usuario 13-oct): el catalogo de requisitos no se reemplaza en silencio.
        if (isForeignKeyError(error)) {
          return NextResponse.json(
            {
              error:
                "No se puede reemplazar el catálogo de requisitos: hay plantillas documentales que justifican algunos de ellos.",
            },
            { status: 409 }
          );
        }
        throw error;
      }
    }
```

- [ ] **Step 6: Verificar que pasa**

Run: `npx vitest run tests/api/document-templates-import.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 7: Commit**

```bash
git add app/lib/prismaErrors.ts app/api/admin/document-templates app/api/import/route.ts tests/api/document-templates-import.test.ts
git commit -m "feat: importacion admin del catalogo documental y 409 al reemplazar requisitos vinculados"
```

---

### Task 7: Trazado de binarios, smoke y limpieza de tests

**Files:**
- Modify: `next.config.ts`
- Modify: `scripts/smoke-routes.mjs`
- Modify: `scripts/clean-test-tenants.mjs`

- [ ] **Step 1: `outputFileTracingIncludes`**

`next.config.ts` queda:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./node_modules/pdfkit/js/data/**/*"],
    // ADR-016 D1: las plantillas viajan en el bundle de las rutas que las leen.
    "/api/projects/\\[id\\]/document-templates/\\[templateId\\]/file": [
      "./docs/fuentes/plantillas-iso/**/*",
    ],
    "/api/admin/document-templates/import": ["./docs/fuentes/plantillas-iso/**/*"],
  },
};

module.exports = nextConfig;
```

- [ ] **Step 2: Smoke con método**

En `scripts/smoke-routes.mjs`, añadir al final de `apiChecks`:

```js
  {
    path: "/api/projects/test-project-id/document-templates",
    expectedStatus: 401,
    name: "document templates list without session",
  },
  {
    path: "/api/projects/test-project-id/document-templates/test-template-id/file",
    expectedStatus: 401,
    name: "document template download without session",
  },
  {
    path: "/api/admin/document-templates/import",
    method: "POST",
    expectedStatus: 401,
    name: "document templates import without session",
  },
```

y cambiar `checkApiStatus`:

```js
async function checkApiStatus({ path, expectedStatus, name, method = "GET" }) {
  const response = await request(path, { redirect: "manual", method });
```

- [ ] **Step 3: Limpieza tras un run fallido**

En `scripts/clean-test-tenants.mjs`, justo antes de `for (const c of companies) {` (el bucle de borrado, después del `if (!APPLY)`):

```js
// Plantillas documentales SYNTHETIC: createdBy e importedBy son Restrict hacia User y
// bloquearian el borrado de los usuarios de test. Versiones y vinculos caen en cascada.
const plantillas = await prisma.documentTemplate.deleteMany({
  where: { fichero: { startsWith: "SYNTHETIC-" } },
});
await prisma.documentTemplateRequirement.deleteMany({
  where: { requirementTemplate: { norma: "SYNTHETIC-19650-9" } },
});
const requisitos = await prisma.requirementTemplate.deleteMany({
  where: { norma: "SYNTHETIC-19650-9" },
});
console.log(`Plantillas SYNTHETIC borradas: ${plantillas.count}; requisitos SYNTHETIC: ${requisitos.count}`);
```

- [ ] **Step 4: Comprobar el script en modo inspección**

Run: `node scripts/clean-test-tenants.mjs`
Expected: `Tenants de test encontrados: 0` (o los que haya) y `Modo inspeccion…`, sin errores.

- [ ] **Step 5: Commit**

```bash
git add next.config.ts scripts/smoke-routes.mjs scripts/clean-test-tenants.mjs
git commit -m "chore: trazado de plantillas en el bundle, smoke 401 y limpieza de datos sinteticos"
```

---

### Task 8: Sección «Documentación» del proyecto

**Files:**
- Create: `app/projects/[id]/ProjectDocumentsSection.tsx`
- Modify: `app/projects/[id]/ProjectClient.tsx` (import junto al de `RequirementEvidencePanel`, enlace tras «Revisar» ~l. 926, montaje antes de `</main>` ~l. 1316)

**Interfaces:**
- Consumes: `GET /api/projects/[id]/document-templates`, URL de descarga (Task 5); `FASES_ORDEN`, `FASE_ETIQUETA`, `Fase` (Task 2).
- Produces: `export default function ProjectDocumentsSection({ projectId }: { projectId: string })`, con ancla `#documentacion`.

No hay tests de componentes en el repo (Vitest con `environment: "node"`). Se verifica con `tsc`, `lint` y la prueba en navegador (Task 10).

- [ ] **Step 1: Crear el componente**

`app/projects/[id]/ProjectDocumentsSection.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Notice } from "@/components/Notice";
import {
  appBadgeBaseStyle,
  appEmptyStateStyle,
  appPanelStyle,
  appSecondaryButtonStyle,
} from "@/components/uiStyles";
import { FASES_ORDEN, FASE_ETIQUETA } from "@/services/document-template.types";

// Entrega 1 (ADR-016): solo catalogo y descarga. Sin estado ni subida, que llegan en la entrega 2.

type Plantilla = {
  id: string;
  nombre: string;
  formato: string;
  fase: string;
  obligatoria: boolean;
  tipo: string;
};

type Props = { projectId: string };

const ERROR_CARGA = "No se pudo cargar la documentación del proyecto.";

export default function ProjectDocumentsSection({ projectId }: Props) {
  const [plantillas, setPlantillas] = useState<Plantilla[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/document-templates`,
          { cache: "no-store" }
        );
        const body = await res.json().catch(() => null);
        if (cancelado) return;
        if (!res.ok) {
          setError(body?.error ?? ERROR_CARGA);
          return;
        }
        setPlantillas(body.data.templates);
      } catch {
        if (!cancelado) setError(ERROR_CARGA);
      }
    }

    void cargar();
    return () => {
      cancelado = true;
    };
  }, [projectId]);

  const urlDescarga = (templateId: string) =>
    `/api/projects/${encodeURIComponent(projectId)}/document-templates/${encodeURIComponent(templateId)}/file`;

  return (
    <section id="documentacion" style={{ ...appPanelStyle, marginTop: 24 }} aria-labelledby="documentacion-titulo">
      <h2 id="documentacion-titulo" style={{ margin: 0, fontSize: 20 }}>
        Documentación
      </h2>
      <p style={{ margin: "6px 0 16px", color: "#475569" }}>
        Plantillas de Eficax que corresponden al rol de este proyecto, ordenadas por fase.
        Descarga la versión vigente de cada una.
      </p>

      {error ? <Notice tone="error" message={error} compact /> : null}
      {plantillas === null && !error ? (
        <p style={{ color: "#64748b" }}>Cargando documentación…</p>
      ) : null}
      {plantillas?.length === 0 ? (
        <div style={appEmptyStateStyle}>
          Todavía no hay plantillas documentales para el rol de este proyecto.
        </div>
      ) : null}

      {FASES_ORDEN.map((fase) => {
        const deLaFase = plantillas?.filter((p) => p.fase === fase) ?? [];
        if (deLaFase.length === 0) return null;
        return (
          <div key={fase} style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>{FASE_ETIQUETA[fase]}</h3>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
              {deLaFase.map((p) => (
                <li
                  key={p.id}
                  style={{
                    alignItems: "center",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                    justifyContent: "space-between",
                    padding: "10px 12px",
                  }}
                >
                  <span style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <span>{p.nombre}</span>
                    <span
                      style={{
                        ...appBadgeBaseStyle,
                        background: p.obligatoria ? "#fef3c7" : "#f1f5f9",
                        color: p.obligatoria ? "#92400e" : "#475569",
                      }}
                    >
                      {p.obligatoria ? "Obligatoria" : "Opcional"}
                    </span>
                    <span style={{ color: "#64748b", fontSize: 13 }}>{p.formato.toUpperCase()}</span>
                  </span>
                  <a href={urlDescarga(p.id)} style={appSecondaryButtonStyle} download>
                    Descargar
                  </a>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
```

- [ ] **Step 2: Montarlo en `ProjectClient.tsx` (sin lógica nueva)**

Tras `import RequirementEvidencePanel from "./RequirementEvidencePanel";`:

```tsx
import ProjectDocumentsSection from "./ProjectDocumentsSection";
```

Tras el enlace «Revisar» de la barra «Flujo de trabajo»:

```tsx
          <a href="#documentacion" style={quickNavLinkStyle}>
            Documentación
          </a>
```

Y entre el `</section>` que cierra el listado de requisitos y `</main>` (final del `return` principal, ~l. 1315-1316):

```tsx
      </section>
      <ProjectDocumentsSection projectId={projectId} />
    </main>
```

- [ ] **Step 3: Tipos y lint**

Run: `npx tsc --noEmit` y `cmd /c "npm run lint"`
Expected: sin errores nuevos. Si `appBadgeBaseStyle` no encaja visualmente, se ajusta en la prueba de navegador.

- [ ] **Step 4: Commit**

```bash
git add "app/projects/[id]/ProjectDocumentsSection.tsx" "app/projects/[id]/ProjectClient.tsx"
git commit -m "feat(ui): seccion Documentacion del proyecto con descarga por fase"
```

---

### Task 9: Bloque «Catálogo documental» en `/admin`

**Files:**
- Create: `app/admin/DocumentCatalogImport.tsx`
- Modify: `app/admin/AdminPanelClient.tsx` (import y montaje antes de la sección «Todos los proyectos», ~l. 400)

**Interfaces:**
- Consumes: `POST /api/admin/document-templates/import` (Task 6), `DocumentTemplateImportSummary` (Task 2).
- Produces: `export default function DocumentCatalogImport({ style }: { style?: React.CSSProperties })`.

- [ ] **Step 1: Crear el componente**

`app/admin/DocumentCatalogImport.tsx`:

```tsx
"use client";

import { useState, type CSSProperties } from "react";
import { Notice } from "@/components/Notice";
import {
  appFieldStyle,
  appPanelStyle,
  appPrimaryButtonStyle,
  getActionStateStyle,
} from "@/components/uiStyles";
import type { DocumentTemplateImportSummary } from "@/services/document-template.types";

const ERROR_IMPORTACION = "No se pudo importar el catálogo documental.";

type Props = { style?: CSSProperties };

export default function DocumentCatalogImport({ style }: Props) {
  const [fichero, setFichero] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [resumen, setResumen] = useState<DocumentTemplateImportSummary | null>(null);
  const [error, setError] = useState("");
  const [detalles, setDetalles] = useState<string[]>([]);
  const bloqueado = !fichero || importando;

  async function importar() {
    if (!fichero) return;
    setImportando(true);
    setError("");
    setDetalles([]);
    setResumen(null);
    try {
      const datos = new FormData();
      datos.append("file", fichero);
      const res = await fetch("/api/admin/document-templates/import", { method: "POST", body: datos });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? ERROR_IMPORTACION);
        setDetalles(Array.isArray(body?.details) ? body.details : []);
        return;
      }
      setResumen(body.data);
    } catch {
      setError(ERROR_IMPORTACION);
    } finally {
      setImportando(false);
    }
  }

  return (
    <section style={style ?? appPanelStyle} aria-labelledby="catalogo-documental-titulo">
      <h2 id="catalogo-documental-titulo" style={{ margin: 0, fontSize: 20 }}>
        Catálogo documental
      </h2>
      <p style={{ margin: "6px 0 16px", color: "#475569" }}>
        Sube el libro <code>plantillas_documentales.xlsx</code>. La importación es de todo o
        nada: si una fila tiene errores, no cambia nada. Las plantillas que ya no estén en el
        libro dejan de ofrecerse, pero no se borran.
      </p>
      <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 10 }}>
        <input
          type="file"
          accept=".xlsx"
          aria-label="Libro del catálogo documental"
          style={appFieldStyle}
          onChange={(e) => setFichero(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={importar}
          disabled={bloqueado}
          aria-disabled={bloqueado}
          style={{ ...appPrimaryButtonStyle, ...getActionStateStyle(bloqueado) }}
        >
          {importando ? "Importando…" : "Importar catálogo documental"}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 12 }}>
          <Notice tone="error" message={error} />
          {detalles.length > 0 ? (
            <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
              {detalles.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {resumen ? (
        <div style={{ marginTop: 12 }}>
          <Notice
            tone="success"
            message={`Catálogo importado: ${resumen.total} plantillas en el libro; ${resumen.created} nuevas, ${resumen.updated} actualizadas, ${resumen.unchanged} sin cambios y ${resumen.retired} retiradas. ${resumen.links} vínculos con requisitos.`}
          />
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 2: Montarlo**

En `app/admin/AdminPanelClient.tsx`, añadir `import DocumentCatalogImport from "./DocumentCatalogImport";` tras el import de `Notice`, y justo antes de la sección «Todos los proyectos» (`<section style={{ ...sectionStyle, ...(isCompact ? compactSectionStyle : {}) }}>` cuyo título es «Todos los proyectos»):

```tsx
      <DocumentCatalogImport
        style={{ ...sectionStyle, ...(isCompact ? compactSectionStyle : {}) }}
      />
```

- [ ] **Step 3: Tipos y lint**

Run: `npx tsc --noEmit` y `cmd /c "npm run lint"`
Expected: sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add app/admin/DocumentCatalogImport.tsx app/admin/AdminPanelClient.tsx
git commit -m "feat(ui): bloque Catalogo documental en /admin"
```

---

### Task 10: Verificación completa y prueba en navegador contra Test

- [ ] **Step 1: Suite completa en serie**

Run: `npm test`
Expected: todos los ficheros en verde, incluidos los 5 nuevos. Si algo falla a mitad: `node scripts/clean-test-tenants.mjs --apply` antes de relanzar.

- [ ] **Step 2: Tipos, lint y build**

Run: `npx tsc --noEmit`, `cmd /c "npm run lint"`, `cmd /c "npm run build"`
Expected: los tres sin errores.

- [ ] **Step 3: Verificar el trazado**

Run (PowerShell):

```powershell
foreach ($f in @(
  '.next/server/app/api/projects/[id]/document-templates/[templateId]/file/route.js.nft.json',
  '.next/server/app/api/admin/document-templates/import/route.js.nft.json'
)) {
  $n = ((Get-Content -LiteralPath $f -Raw | ConvertFrom-Json).files | Where-Object { $_ -like '*plantillas-iso*' }).Count
  "$f -> $n"
}
```

Expected: `26` en las dos (los 26 ficheros de `docs/fuentes/plantillas-iso/`; eran 28 hasta el 14-oct, cuando se retiraron LOIN-V02 y la matriz de interferencias duplicada). Si sale 0: la clave de `outputFileTracingIncludes` no casa con la ruta; parar y revisar.

- [ ] **Step 4: Prueba en navegador (con «adelante» del usuario)**

1. Pedir al usuario que libere memoria. Después, `npm run dev` en segundo plano.
2. **El usuario inicia sesión** con `figual@eficax.com` en `http://localhost:3000/login`. No se firman cookies a mano.
3. `/admin` → «Catálogo documental» → subir `docs/fuentes/trabajo/plantillas_documentales.xlsx` (con Excel cerrado). Esperado: `23 plantillas en el libro; 23 nuevas … 47 vínculos`. Reimportar: `23 sin cambios`.
4. Un proyecto de cada rol en Test (crearlos si no existen; el usuario confirma): la sección «Documentación» muestra 14 (adjudicador), 22 (adjudicatario principal) y 15 (adjudicatario), agrupadas por fase y con la marca de obligatoria.
5. Descargar una plantilla `docx` y otra `xlsx`. Comprobar que se abren y que el nombre con tildes llega bien.
6. El enlace «Documentación» de «Flujo de trabajo» lleva a la sección.

---

### Task 11: Test plan

**Files:**
- Create: `docs/test-plans/documentacion-justificacion.md`

- [ ] **Step 1: Invocar la skill `test-plan`** con el contrato y el security-spec. El documento recoge los tests de las Tasks 2-6, la verificación del trazado y la prueba de navegador, con sus resultados reales.
- [ ] **Step 2: Marcar el checklist** de `docs/component-specs/documentacion-justificacion.md` con lo hecho.
- [ ] **Step 3: Commit**

```bash
git add docs/test-plans/documentacion-justificacion.md docs/component-specs/documentacion-justificacion.md
git commit -m "docs: test plan de la documentacion de justificacion (entrega 1)"
```

---

## Después del plan (fuera de las tasks; cada paso con «adelante»)

1. `git push` de la rama y comprobar en el **preview** de Vercel que una plantilla se descarga (security-spec).
2. **El usuario migra producción antes de fusionar**: `! pwsh -ExecutionPolicy Bypass -File C:/Users/ferna/prueba-app/scripts/migrar-produccion.ps1`, primero sin `-Aplicar`, luego con `-Aplicar`. Si Neon no devuelve la cadena: `! npx --yes neonctl@latest auth`.
3. Fusión **squash** en `main`. Tras el despliegue: el usuario sube el libro desde `/admin` en producción, `npm run smoke` y comprobación 14/22/15.
4. Memoria: `project_baos_documentacion_justificacion.md`, `project_baos_jul01.md` y el índice.
