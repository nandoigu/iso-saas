# Criterio de aceptación y carga por requisito — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retirar los dos prerrequisitos que impiden que la IA actúe como auditor: el criterio de aceptación por requisito y el vínculo documento→requisito declarado desde la interfaz.

**Architecture:** Dos partes independientes que pueden ejecutarse en paralelo. La parte A amplía el importador de Excel existente para leer la quinta columna y expone el criterio por la relación `Requirement → RequirementTemplate`, sin duplicar el texto. La parte B añade la tabla `AnalysisDocument` y un panel lateral de carga por requisito que, en un solo gesto, sube el binario, crea la evidencia y declara el vínculo.

**Tech Stack:** Next.js App Router, Prisma + PostgreSQL (Neon Frankfurt), Vercel Blob client upload, Vitest, estilos en línea desde `components/uiStyles.ts`.

## Global Constraints

- **El criterio de aceptación no se genera nunca con IA.** Es contenido normativo y solo puede venir de los Excel de `docs/fuentes/` (ADR-013, regla de integridad normativa de `CLAUDE.md`).
- **Declarar el vínculo es del dueño; validarlo es del auditor.** No se abre ninguna ruta bajo `/api/admin/` ni se añade `isAdminRole` a la ruta de declaración (ADR-010).
- **`createdBy`, `addedBy` y `validatedBy` salen siempre de la sesión, nunca del body** (security-spec del Evidence Graph).
- **Migraciones puramente aditivas.** Ninguna columna existente se modifica ni se borra.
- **El binario no atraviesa la función serverless.** Se usa el handshake de client upload que ya existe (ADR-004 #3).
- **Cross-tenant responde 404, nunca 403.**
- Tests: `npm test` (vitest run). `fileParallelism: false` ya está configurado; no tocarlo.
- Los comentarios y los mensajes de commit van sin acentos, como el resto del repositorio.

---

## Estructura de ficheros

| Fichero | Responsabilidad | Acción |
|---|---|---|
| `app/lib/requirementImport.ts` | Parseo del libro Excel por rol | Modificar: alias y columna `criterioAceptacion` |
| `services/template.service.ts` | Alta de plantillas en base | Modificar: persistir el criterio |
| `app/api/projects/[id]/requirements/route.ts` | Listado de requisitos del proyecto | Modificar: incluir el criterio por la relación |
| `prisma/schema.prisma` | Modelo de datos | Modificar: `AnalysisDocument` |
| `services/evidence.service.ts` | Ciclo de vida de la evidencia | Modificar: crear `AnalysisDocument` con el `EvidenceItem` |
| `app/api/projects/[id]/evidence/route.ts` | Alta de evidencia | Modificar: aceptar `mediaType` y `sizeBytes` |
| `app/projects/[id]/RequirementEvidencePanel.tsx` | Panel lateral de carga | **Crear** |
| `app/projects/[id]/ProjectClient.tsx` | Lista de requisitos (64 KB) | Modificar: solo el botón y el contador |
| `scripts/preparar-excel-criterios.mjs` | Genera el libro de trabajo | **Crear** |

⚠️ `ProjectClient.tsx` son 64 KB. Todo el estado de subida vive en el panel nuevo. En `ProjectClient.tsx` solo entran el botón, el contador y el `useState` del requisito abierto.

---

# PARTE A — Criterio de aceptación

### Task 1: El parser lee la quinta columna

**Files:**
- Modify: `app/lib/requirementImport.ts:6-15` (tipo), `:44-68` (alias), `:387-397` (column map), `:295-304` (push de la fila)
- Test: `tests/lib/requirementImport.test.ts` (crear)

**Interfaces:**
- Produces: `ParsedRequirementTemplate` gana el campo `criterioAceptacion: string | null`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/lib/requirementImport.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseRoleTemplateRequirementWorkbook } from "@/app/lib/requirementImport";

function libroDePrueba(filas: string[][]): ArrayBuffer {
  const hoja = XLSX.utils.aoa_to_sheet(filas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Hoja1");
  return XLSX.write(libro, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

const CABECERA = [
  "Norma",
  "Item",
  "Título del Requerimiento",
  "Descripción del Requerimiento",
  "Criterio de Aceptación",
];

describe("parseRoleTemplateRequirementWorkbook", () => {
  it("lee el criterio de aceptacion de la quinta columna", async () => {
    const buffer = libroDePrueba([
      CABECERA,
      ["19650-1", "5.1", "PRINCIPIOS", "Descripcion", "Debe existir un BEP firmado."],
    ]);

    const resultado = await parseRoleTemplateRequirementWorkbook(buffer, "no_conforme");

    expect(resultado.errors).toEqual([]);
    expect(resultado.rows[0].criterioAceptacion).toBe("Debe existir un BEP firmado.");
  });

  it("deja el criterio a null cuando la celda esta vacia", async () => {
    const buffer = libroDePrueba([
      CABECERA,
      ["19650-1", "5.1", "PRINCIPIOS", "Descripcion", ""],
    ]);

    const resultado = await parseRoleTemplateRequirementWorkbook(buffer, "no_conforme");

    expect(resultado.rows[0].criterioAceptacion).toBeNull();
  });

  it("sigue importando un libro sin la quinta columna", async () => {
    const buffer = libroDePrueba([
      CABECERA.slice(0, 4),
      ["19650-1", "5.1", "PRINCIPIOS", "Descripcion"],
    ]);

    const resultado = await parseRoleTemplateRequirementWorkbook(buffer, "no_conforme");

    expect(resultado.errors).toEqual([]);
    expect(resultado.rows).toHaveLength(1);
    expect(resultado.rows[0].criterioAceptacion).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar el test y comprobar que falla**

Run: `npx vitest run tests/lib/requirementImport.test.ts`
Expected: FAIL. Los dos primeros casos fallan con `undefined` en vez del texto y de `null`.

- [ ] **Step 3: Añadir el campo al tipo**

En `app/lib/requirementImport.ts`, dentro de `ParsedRequirementTemplate` (línea 6), tras `descripcion: string;`:

```typescript
  criterioAceptacion: string | null;
```

- [ ] **Step 4: Añadir los alias de cabecera**

En `HEADER_ALIASES` (línea 44), tras el bloque `descripcion`:

```typescript
  criterioAceptacion: [
    "criterio de aceptacion",
    "criterio de aceptación",
    "criterio_de_aceptacion",
    "criterio_de_aceptación",
    "criterio",
  ],
```

- [ ] **Step 5: Añadir la columna al mapa de rol**

En `getRoleTemplateColumnMap` (línea 387), tras la línea de `fase`:

```typescript
    criterioAceptacion: findHeaderIndex(normalized, HEADER_ALIASES.criterioAceptacion),
```

⚠️ **No tocar `hasRoleHeaders`.** Comprueba presencia de cuatro columnas, no conjunto exacto: es lo que permite que un libro sin la quinta siga importando. Añadir ahí el criterio rompería los tres Excel actuales.

- [ ] **Step 6: Leer la celda y ponerla en la fila**

En el parser de rol, junto a `const descripcion = getRequiredString(...)` (línea 257):

```typescript
    const criterioAceptacion =
      columnMap.criterioAceptacion === -1
        ? null
        : getOptionalString(row[columnMap.criterioAceptacion]);
```

Y en el `rows.push({...})` (línea 295), tras `descripcion,`:

```typescript
      criterioAceptacion,
```

- [ ] **Step 7: Reparar el otro constructor de filas**

El parser detallado (línea 148) construye el mismo tipo y ahora no compila. En su `rows.push`, añadir:

```typescript
      criterioAceptacion: null,
```

Es correcto: el formato detallado es el de requisitos de un proyecto y no transporta criterio.

- [ ] **Step 8: Ejecutar los tests**

Run: `npx vitest run tests/lib/requirementImport.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 9: Comprobar que no se ha roto nada**

Run: `npm test`
Expected: PASS. La suite estaba en 117 tests; ahora 120.

- [ ] **Step 10: Commit**

```bash
git add app/lib/requirementImport.ts tests/lib/requirementImport.test.ts
git commit -m "feat: el importador lee el criterio de aceptacion (ADR-013 D2)"
```

---

### Task 2: El criterio se persiste al importar

**Files:**
- Modify: `services/template.service.ts:38-48`
- Test: `tests/services/template.service.test.ts` (crear)

**Interfaces:**
- Consumes: `ParsedRequirementTemplate.criterioAceptacion` de la Task 1.
- Produces: `RequirementTemplate.criterioAceptacion` poblado.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/services/template.service.test.ts`:

```typescript
import { describe, it, expect, afterAll } from "vitest";
import * as XLSX from "xlsx";
import { prisma } from "@/app/lib/prisma";
import { importTemplates } from "@/services/template.service";

const NORMA_DE_PRUEBA = "TEST-CRITERIO";

function libroDeRol(): Buffer {
  const hoja = XLSX.utils.aoa_to_sheet([
    [
      "Norma",
      "Item",
      "Título del Requerimiento",
      "Descripción del Requerimiento",
      "Criterio de Aceptación",
    ],
    [NORMA_DE_PRUEBA, "9.9", "TITULO", "Descripcion", "Debe existir un BEP firmado por las partes."],
  ]);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Hoja1");
  return XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

afterAll(async () => {
  await prisma.requirementTemplate.deleteMany({ where: { norma: NORMA_DE_PRUEBA } });
});

describe("importTemplates", () => {
  it("guarda el criterio de aceptacion de la quinta columna", async () => {
    await importTemplates(libroDeRol(), "requerimientos_adjudicador.xlsx");

    const plantilla = await prisma.requirementTemplate.findFirst({
      where: { norma: NORMA_DE_PRUEBA, item: "9.9" },
    });

    expect(plantilla?.criterioAceptacion).toBe(
      "Debe existir un BEP firmado por las partes."
    );
  });
});
```

- [ ] **Step 2: Ejecutar el test y comprobar que falla**

Run: `npx vitest run tests/services/template.service.test.ts`
Expected: FAIL con `expected null to be "Debe existir un BEP firmado por las partes."`

- [ ] **Step 3: Persistir el campo**

En `services/template.service.ts`, dentro del `data:` de `createMany` (línea 38), tras `evidencia: null,`:

```typescript
      // ADR-013 D2: el criterio viaja en la quinta columna del Excel de la fuente.
      // No se reutiliza `evidencia`, que tiene otra semantica y la usan 21 ficheros.
      criterioAceptacion: row.criterioAceptacion,
```

- [ ] **Step 4: Ejecutar el test**

Run: `npx vitest run tests/services/template.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/template.service.ts tests/services/template.service.test.ts
git commit -m "feat: importTemplates persiste el criterio de aceptacion"
```

---

### Task 3: El requisito expone el criterio de su plantilla

**Files:**
- Modify: `app/api/projects/[id]/requirements/route.ts`
- Test: `tests/api/requirements-criterio.test.ts` (crear)

**Interfaces:**
- Produces: cada requisito del listado incluye `criterioAceptacion: string | null`.

⚠️ **El criterio NO se copia a `Requirement`.** Se lee por la relación `Requirement.template`, que ya existe (`templateId`, `onDelete: SetNull`). Copiarlo exigiría una migración y dejaría copias obsoletas en cada proyecto cuando el experto corrija un criterio. ADR-013 D2 lo define como global y recuperable por identidad de plantilla, que es exactamente esta relación. Un requisito importado del Excel de un proyecto no tiene plantilla y devuelve `null`: es correcto.

- [ ] **Step 1: Leer cómo autentican los tests de API existentes**

Run: `sed -n '1,40p' tests/api/evidence.test.ts` y `sed -n '16,40p' tests/helpers/db.ts`

Anotar cómo `createTenant` devuelve la sesión y cómo se construye la `Request` autenticada. El test del paso siguiente debe usar exactamente ese mecanismo, no uno inventado.

- [ ] **Step 2: Escribir el test que falla**

Crear `tests/api/requirements-criterio.test.ts`, sustituyendo la autenticación por la que se acaba de leer:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/app/lib/prisma";
import { GET } from "@/app/api/projects/[id]/requirements/route";
import { createProject, createTenant, cleanupTenant } from "@/tests/helpers/db";

let tenant: Awaited<ReturnType<typeof createTenant>>;
let project: Awaited<ReturnType<typeof createProject>>;
let plantillaId: string;

beforeAll(async () => {
  tenant = await createTenant("criterio");
  project = await createProject(tenant.company.id, tenant.user.id);

  const plantilla = await prisma.requirementTemplate.create({
    data: {
      norma: "TEST-API",
      item: "1.1",
      name: "TITULO",
      titulo: "TITULO",
      descripcion: "Descripcion",
      role: "adjudicador",
      criterioAceptacion: "Debe existir un BEP firmado.",
      defaultStatus: "no_conforme",
    },
  });
  plantillaId = plantilla.id;

  await prisma.requirement.create({
    data: {
      projectId: project.id,
      templateId: plantillaId,
      name: "TITULO",
      titulo: "TITULO",
      descripcion: "Descripcion",
      norma: "TEST-API",
      item: "1.1",
      status: "no_conforme",
    },
  });
});

afterAll(async () => {
  await cleanupTenant(tenant.company.id);
  await prisma.requirementTemplate.delete({ where: { id: plantillaId } });
});

describe("GET /api/projects/[id]/requirements", () => {
  it("devuelve el criterio de aceptacion de la plantilla", async () => {
    const req = new Request("http://localhost/api/projects/x/requirements", {
      headers: { cookie: tenant.cookie },
    });

    const res = await GET(req, { params: Promise.resolve({ id: project.id }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.requirements[0].criterioAceptacion).toBe("Debe existir un BEP firmado.");
  });
});
```

- [ ] **Step 3: Ejecutar el test y comprobar que falla**

Run: `npx vitest run tests/api/requirements-criterio.test.ts`
Expected: FAIL con `expected undefined to be "Debe existir un BEP firmado."`

- [ ] **Step 4: Incluir la relación en la consulta**

En `app/api/projects/[id]/requirements/route.ts`, en el `findMany` de requisitos, añadir:

```typescript
      include: { template: { select: { criterioAceptacion: true } } },
```

y aplanar antes de responder:

```typescript
    const requirements = filas.map(({ template, ...requisito }) => ({
      ...requisito,
      // ADR-013 D2: el criterio es global y vive en la plantilla. Se lee por la
      // relacion en vez de copiarse, para que corregirlo alcance a todos los
      // proyectos y no queden copias obsoletas.
      criterioAceptacion: template?.criterioAceptacion ?? null,
    }));
```

⚠️ Si el handler ya nombra de otra forma la variable del `findMany`, respetar el nombre existente.

- [ ] **Step 5: Ejecutar el test**

Run: `npx vitest run tests/api/requirements-criterio.test.ts`
Expected: PASS.

- [ ] **Step 6: Ejecutar la suite completa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/api/projects/[id]/requirements/route.ts tests/api/requirements-criterio.test.ts
git commit -m "feat: el listado de requisitos expone el criterio de su plantilla"
```

---

### Task 4: Libro de trabajo para escribir los 91 criterios

**Files:**
- Create: `scripts/preparar-excel-criterios.mjs`

**Interfaces:**
- Produces: tres `.xlsx` en `docs/fuentes/trabajo/` con una fila por requisito y las cuatro casillas de ADR-013 D3.

- [ ] **Step 1: Escribir el script**

Crear `scripts/preparar-excel-criterios.mjs`:

```javascript
// Genera el libro de trabajo para escribir los criterios de aceptacion.
//
// No inventa contenido: copia norma, item, titulo y descripcion de los Excel de
// docs/fuentes/ y deja cuatro columnas vacias para que las rellene el experto.
// El criterio es contenido normativo y no puede salir de un modelo (ADR-013).
//
// Uso: node scripts/preparar-excel-criterios.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";

const ORIGEN = "docs/fuentes";
const DESTINO = join(ORIGEN, "trabajo");

const LIBROS = [
  "requerimientos_adjudicador.xlsx",
  "requerimientos_adjudicatario principal.xlsx",
  "requerimientos_adjudicatario.xlsx",
];

// Los cuatro apartados de ADR-013 D3, en su orden.
const APARTADOS = [
  "1. Que documento lo satisface",
  "2. Que debe encontrarse dentro",
  "3. Que NO basta",
  "4. Frontera entre NC mayor y NC menor",
];

mkdirSync(DESTINO, { recursive: true });

for (const nombre of LIBROS) {
  const libro = XLSX.read(readFileSync(join(ORIGEN, nombre)));
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, blankrows: false });

  const salida = [
    [
      "Norma",
      "Item",
      "Título del Requerimiento",
      "Descripción del Requerimiento",
      ...APARTADOS,
    ],
  ];

  for (const fila of filas.slice(1)) {
    const [norma, item, titulo, descripcion] = fila;
    if (!norma && !item && !titulo) continue;
    salida.push([norma ?? "", item ?? "", titulo ?? "", descripcion ?? "", "", "", "", ""]);
  }

  const hojaSalida = XLSX.utils.aoa_to_sheet(salida);
  hojaSalida["!cols"] = [
    { wch: 10 }, { wch: 8 }, { wch: 40 }, { wch: 60 },
    { wch: 40 }, { wch: 50 }, { wch: 40 }, { wch: 40 },
  ];

  const libroSalida = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libroSalida, hojaSalida, "Criterios");
  writeFileSync(
    join(DESTINO, nombre),
    XLSX.write(libroSalida, { type: "buffer", bookType: "xlsx" })
  );

  console.log(`${nombre}: ${salida.length - 1} requisitos`);
}
```

- [ ] **Step 2: Ejecutarlo y verificar los recuentos**

Run: `node scripts/preparar-excel-criterios.mjs`
Expected:
```
requerimientos_adjudicador.xlsx: 38 requisitos
requerimientos_adjudicatario principal.xlsx: 35 requisitos
requerimientos_adjudicatario.xlsx: 18 requisitos
```

⚠️ Si algún recuento no coincide, **parar**. 38/35/18 es el catálogo verificado contra producción el 11-ago; una desviación significa que el parseo se ha comido filas.

- [ ] **Step 3: Commit**

```bash
git add scripts/preparar-excel-criterios.mjs
git commit -m "chore: script del libro de trabajo para los criterios de aceptacion"
```

⚠️ **Los libros generados en `docs/fuentes/trabajo/` no se commitean todavía.** Se commitean cuando lleven contenido escrito por el experto, que es lo que los convierte en fuente autorizada.

- [ ] **Step 4: Entregar el libro de adjudicador**

Se entrega al responsable de producto para que escriba los 38 criterios. Al devolverlo relleno: importar desde la pantalla de plantillas, que ya usa `importTemplates`, y verificar el recuento:

```bash
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.requirementTemplate.count({where:{role:'adjudicador',criterioAceptacion:{not:null}}}).then(n=>{console.log('con criterio:',n);return p.\$disconnect()})"
```
Expected: `con criterio: 38`

---

# PARTE B — Carga de evidencia por requisito

### Task 5: Migración de `AnalysisDocument`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_analysis_document/migration.sql` (la genera Prisma)

**Interfaces:**
- Produces: modelo `AnalysisDocument` y back-relations en `EvidenceItem` y `User`.

- [ ] **Step 1: Añadir el modelo**

En `prisma/schema.prisma`, copiado del domain model (`docs/domain-models/audit-intelligence-platform.md`), sin desviaciones:

```prisma
// ─────────────────────────────────────────────────────────────────────────────
// AUDIT INTELLIGENCE PLATFORM — Documento preparado para analisis
// No almacena el contenido: el PDF viaja nativo a la API (ADR-008 D5).
// ─────────────────────────────────────────────────────────────────────────────

model AnalysisDocument {
  id                String   @id @default(cuid())
  evidenceItemId    String   @unique // tenant isolation via evidenceItem → project → company
  mediaType         String // "application/pdf" | ...
  pageCount         Int? // null hasta que se inspecciona
  sizeBytes         Int
  status            String   @default("pending") // "pending" | "ready" | "unsupported" | "failed"
  unsupportedReason String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  createdBy         String // userId

  evidenceItem EvidenceItem @relation(fields: [evidenceItemId], references: [id], onDelete: Restrict)
  creator      User         @relation("AnalysisDocumentCreator", fields: [createdBy], references: [id], onDelete: Restrict)

  @@index([status])
  @@index([createdBy])
}
```

⚠️ La relación `citations FindingCitation[]` del domain model **se omite**: `FindingCitation` no existe todavía y es de la fase de IA. Se añadirá entonces.

- [ ] **Step 2: Añadir las back-relations**

En `model EvidenceItem` (línea 289), junto a las demás relaciones:

```prisma
  analysisDocument AnalysisDocument?
```

En `model User`, junto a las demás:

```prisma
  analysisDocuments AnalysisDocument[] @relation("AnalysisDocumentCreator")
```

- [ ] **Step 3: Comprobar el destino antes de migrar**

Run: `npx prisma migrate status`
Expected: el host debe ser la rama **Test** de Frankfurt (`ep-jolly-resonance-b2y3s9ni`).

⚠️ Si aparece `ep-empty-dawn-b28leeni`, **parar**: es producción. El CLI de Prisma lee `.env`, no `.env.local`.

- [ ] **Step 4: Generar la migración**

Run: `npx prisma migrate dev --name add_analysis_document`
Expected: migración aplicada a Test y cliente regenerado.

- [ ] **Step 5: Revisar el SQL generado**

Run: `cat prisma/migrations/*_add_analysis_document/migration.sql`
Expected: solo `CREATE TABLE`, `CREATE UNIQUE INDEX`, `CREATE INDEX` y `ALTER TABLE "AnalysisDocument" ADD CONSTRAINT`. Si aparece un `ALTER TABLE` sobre cualquier otra tabla, **parar**: la migración ha dejado de ser aditiva.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: migracion aditiva de AnalysisDocument"
```

---

### Task 6: La evidencia nace con su `AnalysisDocument`

**Files:**
- Modify: `services/evidence.service.ts:119-148`, `services/evidence.types.ts`
- Modify: `app/api/projects/[id]/evidence/route.ts:46-90`
- Test: `tests/services/evidence.service.test.ts` (añadir casos)

**Interfaces:**
- Consumes: el modelo de la Task 5.
- Produces: `createEvidenceItem` acepta `mediaType?: string` y `sizeBytes?: number` en `CreateEvidenceItemInput` y crea el `AnalysisDocument` dentro de la misma transacción.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `tests/services/evidence.service.test.ts`, dentro del `describe` de `createEvidenceItem`:

```typescript
  it("crea el AnalysisDocument en la misma transaccion que la evidencia", async () => {
    const resultado = await createEvidenceItem(
      {
        projectId: projectA.id,
        title: "BEP del proyecto",
        type: "document",
        createdBy: tenantA.user.id,
        mediaType: "application/pdf",
        sizeBytes: 1415577,
      },
      { userId: tenantA.user.id, isAdmin: false }
    );

    const item = "item" in resultado ? resultado.item : null;
    expect(item).not.toBeNull();

    const documento = await prisma.analysisDocument.findUnique({
      where: { evidenceItemId: item!.id },
    });

    expect(documento).not.toBeNull();
    expect(documento!.mediaType).toBe("application/pdf");
    expect(documento!.sizeBytes).toBe(1415577);
    expect(documento!.status).toBe("pending");
    expect(documento!.pageCount).toBeNull();
  });

  it("no crea AnalysisDocument si no se declara el fichero", async () => {
    const resultado = await createEvidenceItem(
      {
        projectId: projectA.id,
        title: "Declaracion verbal",
        type: "declaration",
        createdBy: tenantA.user.id,
      },
      { userId: tenantA.user.id, isAdmin: false }
    );

    const item = "item" in resultado ? resultado.item : null;
    const documento = await prisma.analysisDocument.findUnique({
      where: { evidenceItemId: item!.id },
    });

    expect(documento).toBeNull();
  });
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `npx vitest run tests/services/evidence.service.test.ts -t "AnalysisDocument"`
Expected: FAIL. El primer caso da `expected null not to be null`.

- [ ] **Step 3: Ampliar el tipo de entrada**

En `services/evidence.types.ts`, en `CreateEvidenceItemInput`:

```typescript
  // Los declara el cliente en el momento de la subida: EvidenceItem no guarda
  // tipo ni tamano, y recuperarlos despues obligaria a interrogar al store
  // fichero a fichero.
  mediaType?: string;
  sizeBytes?: number;
```

- [ ] **Step 4: Crear el documento dentro de la transacción**

En `services/evidence.service.ts`, dentro del `prisma.$transaction` de `createEvidenceItem`, tras la llamada a `createVersionSnapshot`:

```typescript
    // El documento de analisis nace con la evidencia porque `mediaType` y
    // `sizeBytes` solo se conocen en el momento de la subida. `pageCount` y
    // `status` los completa la fase de analisis (domain model AIP).
    if (input.mediaType && typeof input.sizeBytes === "number") {
      await tx.analysisDocument.create({
        data: {
          evidenceItemId: created.id,
          mediaType: input.mediaType,
          sizeBytes: input.sizeBytes,
          createdBy: input.createdBy,
        },
      });
    }
```

- [ ] **Step 5: Aceptar los campos en el handler**

En `app/api/projects/[id]/evidence/route.ts`, dentro de la llamada a `createEvidenceItem`:

```typescript
        mediaType: typeof body.mediaType === "string" ? body.mediaType : undefined,
        sizeBytes: typeof body.sizeBytes === "number" ? body.sizeBytes : undefined,
```

- [ ] **Step 6: Ejecutar los tests del servicio**

Run: `npx vitest run tests/services/evidence.service.test.ts`
Expected: PASS.

- [ ] **Step 7: Ejecutar la suite completa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add services/evidence.service.ts services/evidence.types.ts app/api/projects/[id]/evidence/route.ts tests/services/evidence.service.test.ts
git commit -m "feat: la evidencia nace con su AnalysisDocument"
```

---

### Task 7: Panel lateral de carga por requisito

**Files:**
- Create: `app/projects/[id]/RequirementEvidencePanel.tsx`

**Interfaces:**
- Consumes: `POST /api/projects/[id]/evidence` (Task 6) y `POST /api/projects/[id]/requirements/[requirementId]/evidence-links`.
- Produces: componente `RequirementEvidencePanel` con props `{ projectId, requirement, documentos, onClose, onUploaded }`.

El gesto son tres pasos encadenados: `upload()` de `@vercel/blob/client` contra la ruta de token, alta de la evidencia, y declaración del vínculo bajo el requisito. **La declaración va por su propia ruta a propósito** (ADR-010): meter `requirementId` en el alta de la evidencia crearía el vínculo fuera de la ruta que ADR-010 le asignó.

- [ ] **Step 1: Escribir el componente**

Crear `app/projects/[id]/RequirementEvidencePanel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import {
  appPanelStyle,
  appPrimaryButtonStyle,
  appSecondaryButtonStyle,
  appFormLabelStyle,
  appEmptyStateStyle,
  getActionStateStyle,
} from "@/components/uiStyles";

export type RequisitoDelPanel = {
  id: string;
  item: string;
  titulo: string;
  criterioAceptacion: string | null;
};

export type DocumentoPresentado = {
  id: string;
  title: string;
  linkType: string;
};

type Props = {
  projectId: string;
  requirement: RequisitoDelPanel;
  documentos: DocumentoPresentado[];
  onClose: () => void;
  onUploaded: () => void;
};

// Solo "primary" y "supporting": marcar una evidencia como contradictoria es
// juzgar el cumplimiento, y eso es del auditor (ADR-010). La ruta devuelve 403.
const TIPOS_DECLARABLES = [
  { valor: "primary", etiqueta: "Documento principal" },
  { valor: "supporting", etiqueta: "Documento de apoyo" },
] as const;

export default function RequirementEvidencePanel({
  projectId,
  requirement,
  documentos,
  onClose,
  onUploaded,
}: Props) {
  const [fichero, setFichero] = useState<File | null>(null);
  const [linkType, setLinkType] = useState<string>("primary");
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function presentar() {
    if (!fichero) return;
    setSubiendo(true);
    setError(null);

    try {
      const blob = await upload(fichero.name, fichero, {
        access: "public",
        handleUploadUrl: `/api/projects/${projectId}/evidence/upload-token`,
      });

      const resEvidencia = await fetch(`/api/projects/${projectId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fichero.name,
          type: "document",
          sourceRef: blob.url,
          mediaType: fichero.type || "application/octet-stream",
          sizeBytes: fichero.size,
        }),
      });

      const evidencia = await resEvidencia.json();
      if (!resEvidencia.ok) {
        throw new Error(evidencia.error ?? "No se pudo registrar la evidencia.");
      }

      const resVinculo = await fetch(
        `/api/projects/${projectId}/requirements/${requirement.id}/evidence-links`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ evidenceItemId: evidencia.item.id, linkType }),
        }
      );

      if (!resVinculo.ok) {
        const fallo = await resVinculo.json();
        throw new Error(fallo.error ?? "No se pudo declarar el vinculo.");
      }

      setFichero(null);
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al presentar el documento.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <aside style={{ ...appPanelStyle, position: "sticky", top: 16 }}>
      <h3 style={{ margin: "0 0 4px" }}>
        {requirement.item} · {requirement.titulo}
      </h3>

      {requirement.criterioAceptacion ? (
        <p style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: "0 0 16px" }}>
          {requirement.criterioAceptacion}
        </p>
      ) : (
        <p style={{ ...appEmptyStateStyle, margin: "0 0 16px" }}>
          Este requisito todavia no tiene criterio de aceptacion escrito.
        </p>
      )}

      <h4 style={appFormLabelStyle}>Documentos presentados</h4>
      {documentos.length === 0 ? (
        <p style={appEmptyStateStyle}>Ninguno todavia.</p>
      ) : (
        <ul style={{ paddingLeft: 18, margin: "0 0 16px" }}>
          {documentos.map((doc) => (
            <li key={doc.id} style={{ fontSize: 13 }}>
              {doc.title} <span style={{ opacity: 0.6 }}>({doc.linkType})</span>
            </li>
          ))}
        </ul>
      )}

      <label style={appFormLabelStyle} htmlFor="fichero-evidencia">
        Presentar un documento
      </label>
      <input
        id="fichero-evidencia"
        type="file"
        onChange={(e) => setFichero(e.target.files?.[0] ?? null)}
        disabled={subiendo}
      />

      <div style={{ margin: "12px 0" }}>
        {TIPOS_DECLARABLES.map((tipo) => (
          <label key={tipo.valor} style={{ display: "block", fontSize: 13 }}>
            <input
              type="radio"
              name="linkType"
              value={tipo.valor}
              checked={linkType === tipo.valor}
              onChange={() => setLinkType(tipo.valor)}
              disabled={subiendo}
            />{" "}
            {tipo.etiqueta}
          </label>
        ))}
      </div>

      {error && <p style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p>}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={presentar}
          disabled={!fichero || subiendo}
          style={{ ...appPrimaryButtonStyle, ...getActionStateStyle(!fichero || subiendo) }}
        >
          {subiendo ? "Presentando..." : "Presentar"}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={appSecondaryButtonStyle}
          disabled={subiendo}
        >
          Cerrar
        </button>
      </div>
    </aside>
  );
}
```

⚠️ `access: "public"` es lo que exige la firma de `upload()`; **quien impone la privacidad real es el store**, configurado como privado (ADR-014). No cambiar el store sin releer ese ADR.

- [ ] **Step 2: Comprobar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores. Si algún nombre de `components/uiStyles.ts` no coincide, abrir el fichero y usar el real.

- [ ] **Step 3: Commit**

```bash
git add app/projects/[id]/RequirementEvidencePanel.tsx
git commit -m "feat: panel lateral de carga de evidencia por requisito"
```

---

### Task 8: Botón y contador en la lista de requisitos

**Files:**
- Modify: `app/projects/[id]/ProjectClient.tsx`

**Interfaces:**
- Consumes: `RequirementEvidencePanel` de la Task 7.

⚠️ El fichero son 64 KB. **Solo se añaden tres cosas**: el import, un `useState` con el requisito abierto, y el botón dentro de la fila. Ninguna lógica de subida entra aquí.

- [ ] **Step 1: Localizar la lista y la recarga**

Run: `grep -n "requirements\|requisitos" app/projects/\[id\]/ProjectClient.tsx | head -40`

Anotar el nombre del array de requisitos y el de la función que los recarga. Los pasos siguientes usan esos nombres, no unos inventados.

- [ ] **Step 2: Importar el panel**

```tsx
import RequirementEvidencePanel from "./RequirementEvidencePanel";
```

- [ ] **Step 3: Añadir el estado**

Junto a los demás `useState`:

```tsx
  const [requisitoAbierto, setRequisitoAbierto] = useState<string | null>(null);
```

- [ ] **Step 4: Añadir el botón a la fila**

Dentro del `map` que pinta cada requisito, al final de la fila:

```tsx
  <button
    type="button"
    onClick={() =>
      setRequisitoAbierto(requisito.id === requisitoAbierto ? null : requisito.id)
    }
    style={appSecondaryButtonStyle}
  >
    {requisito.evidenceLinks?.length ?? 0} docs
  </button>
```

- [ ] **Step 5: Montar el panel**

Junto a la lista, dentro del contenedor que ya la envuelve, usando los nombres anotados en el paso 1:

```tsx
  {requisitoAbierto && (
    <RequirementEvidencePanel
      projectId={projectId}
      requirement={requisitos.find((r) => r.id === requisitoAbierto)!}
      documentos={
        requisitos.find((r) => r.id === requisitoAbierto)?.evidenceLinks?.map((v) => ({
          id: v.id,
          title: v.evidenceItem.title,
          linkType: v.linkType,
        })) ?? []
      }
      onClose={() => setRequisitoAbierto(null)}
      onUploaded={() => recargarRequisitos()}
    />
  )}
```

⚠️ Si el listado de requisitos todavía no trae `evidenceLinks`, ampliarlo en `app/api/projects/[id]/requirements/route.ts` con `include: { evidenceLinks: { include: { evidenceItem: { select: { title: true } } } } }`, junto al `include` del criterio que añadió la Task 3.

- [ ] **Step 6: Comprobar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Probar el gesto completo**

Run: `npm run dev`, abrir `/projects/<id>`, pulsar el botón de un requisito y subir un PDF. Después:

```bash
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();Promise.all([p.evidenceRequirementLink.count(),p.analysisDocument.count()]).then(([v,d])=>{console.log('vinculos:',v,'documentos:',d);return p.\$disconnect()})"
```
Expected: ambos contadores suben en 1 respecto a antes de la prueba.

- [ ] **Step 8: Ejecutar la suite completa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/projects/[id]/ProjectClient.tsx app/api/projects/[id]/requirements/route.ts
git commit -m "feat: boton de carga y contador de documentos por requisito"
```

---

## Qué queda fuera de este plan

- El componente de IA (`AnalysisRun`, `AnalysisFinding`, `FindingCitation`, `FindingDecision`, `AiInference`, `ai-provider.ts`). Es la fase siguiente y tiene su domain model ya escrito.
- La pantalla del auditor. Se construye después de la IA, en su forma definitiva: revisar propuestas, sin modo de valoración desde cero.
- Aplicar la migración de la Task 5 a producción. Va por `scripts/migrar-produccion.ps1` y lo ejecuta el usuario, porque el clasificador de auto-mode bloquea las escrituras a producción.
