# API Contract: Documentación de justificación por proyecto (entrega 1)

> BAOS Component: Evidence Graph (catálogo de plantillas documentales)
> Domain Model: docs/domain-models/documentacion-justificacion.md
> ADR: ADR-016
> Phase: Phase 1 — Technological Foundation
> Date: 2026-10-13
> Status: Draft

## Summary

Tres rutas nuevas y un cambio en una existente:

1. El dueño del proyecto (o un admin) **lista** las plantillas aplicables a su proyecto.
2. Las **descarga**.
3. Un admin **importa** el catálogo subiendo el libro del experto.
4. `POST /api/import` deja de dar 500 cuando el catálogo de requisitos está protegido por vínculos y responde 409.

Convenciones del proyecto que se siguen: `getAuthSession(req)` de `app/lib/auth.ts`; respuesta `{ data }` o `{ error }`; `/api/admin/` significa solo admin, sin excepciones (ADR-004); lo ajeno es **404, nunca 403**; segmento `[id]` y no `[projectId]` bajo `app/api/projects/` (colisión de slug, ver `app/api/projects/[id]/evidence/route.ts`).

---

## Endpoints

### `GET /api/projects/[id]/document-templates`

**Purpose**: Plantillas aplicables al proyecto: vigentes y con `Project.role` entre sus `roles`.
**Auth**: Required — `getAuthSession(req)`
**RBAC**: dueño del proyecto o admin
**Tenant scope**: el proyecto se busca con `findProjectForActor` (dueño = `userId`; admin = cualquiera). Si no se encuentra: 404.

Sin parámetros.

#### Response — 200 OK

```typescript
type ListDocumentTemplatesResponse = {
  data: {
    projectRole: ProjectRole;
    templates: ProjectDocumentTemplate[]; // ordenadas por fase (FASES_ORDEN) y luego por nombre
  };
};

type ProjectDocumentTemplate = {
  id: string;
  nombre: string;
  formato: "docx" | "xlsx";
  fase: Fase;
  obligatoria: boolean;
  tipo: "iso" | "administrativa" | "ambas";
};
```

No devuelve `fichero` (ruta interna) ni los vínculos con requisitos: la entrega 1 no los muestra.

#### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | Sin sesión |
| 404 | Proyecto inexistente o ajeno |
| 500 | Error inesperado |

---

### `GET /api/projects/[id]/document-templates/[templateId]/file`

**Purpose**: Descarga del binario de la plantilla vigente (ADR-016 D1).
**Auth**: Required
**RBAC**: dueño del proyecto o admin
**Tenant scope**: proyecto vía `findProjectForActor`; la plantilla debe ser **aplicable** a ese proyecto (vigente y rol incluido). Cualquier otro caso: 404.

#### Comportamiento

1. Resuelve el fichero **solo** desde `DocumentTemplate.fichero`. Nada de la URL forma parte de la ruta en disco.
2. Comprueba que `path.resolve(PLANTILLAS_DIR, fichero)` queda dentro de `PLANTILLAS_DIR`. Si no: 404 y log de error.
3. Si el fichero no existe en el bundle: **500** con log explícito (`plantilla en catalogo sin binario desplegado`). Es un fallo de despliegue, no del usuario.
4. Responde por **streaming** (`Readable.toWeb(createReadStream(...))`).

#### Response — 200 OK (binario)

| Cabecera | Valor |
|---|---|
| `Content-Type` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (docx) · `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (xlsx) |
| `Content-Disposition` | `attachment; filename="<ascii>"; filename*=UTF-8''<fichero codificado>` |
| `Content-Length` | tamaño del fichero |
| `Cache-Control` | `private, no-store` |
| `X-Content-Type-Options` | `nosniff` |

#### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | Sin sesión |
| 404 | Proyecto ajeno o inexistente; plantilla inexistente, no vigente o no aplicable al rol |
| 500 | Binario ausente del bundle o error inesperado |

---

### `POST /api/admin/document-templates/import`

**Purpose**: Cargar o actualizar el catálogo desde `plantillas_documentales.xlsx` (ADR-016 D2, D3).
**Auth**: Required
**RBAC**: admin. Cuenta bloqueada: 403 con `BLOCKED_ACCOUNT_MESSAGE` (como `/api/import-templates`).
**Tenant scope**: no aplica (catálogo global). El actor (`createdBy`, `updatedBy`, `importedBy`) sale de la sesión.

#### Request

`multipart/form-data` con `file`: el `.xlsx`. Se lee con `readSafeXlsxUpload`. Se procesa la hoja **«Plantillas»**; la hoja «Requisitos (consulta)» se ignora: los requisitos se resuelven contra la base, no contra el libro.

#### Validation Rules (por fila, todas en la misma pasada)

| Columna | Regla |
|---|---|
| Fichero | obligatorio; único en el libro; debe existir en `docs/fuentes/plantillas-iso/` |
| Formato | `docx` o `xlsx`, y coherente con la extensión del fichero |
| Nombre | obligatorio |
| Vigente | `si`/`sí`/`no` (sin distinguir mayúsculas ni tildes) |
| Rol | uno o varios separados por coma; `adjudicatario principal` → `adjudicatario_principal`; valores de `Project.role` |
| Fase | una de las seis; con o sin tilde |
| Obligatoria | `si`/`sí`/`no` |
| Tipo | `iso`, `administrativa` o `ambas` |
| Requisitos que justifica | separador `;` o `,`; prefijo `ISO` opcional; formato `19650-N/ítem`; la norma se arrastra. Cada referencia debe resolver contra `RequirementTemplate (role, norma, item)` para **al menos un** rol de la fila; se vincula a los roles en los que resuelve. Vacía: permitida (documento administrativo) |

Las cabeceras se reconocen por nombre normalizado (como `requirementImport.ts`), no por posición.

#### Comportamiento

- **Todo o nada**, en una transacción. Con cualquier error no se escribe nada.
- Por `fichero`: crea, actualiza o deja igual. Solo hay versión nueva si cambia algún campo o el conjunto de requisitos (domain model, invariante 3).
- Plantillas de la base que no están en el libro: `vigente = false` con versión nueva, si no lo estaban ya.
- Nunca borra.

#### Response — 200 OK

```typescript
type ImportDocumentTemplatesResponse = {
  data: {
    total: number;       // filas del libro
    created: number;
    updated: number;
    unchanged: number;
    retired: number;     // pasaron a vigente = false en esta importacion
    links: number;       // vinculos plantilla-requisito resultantes
  };
};
```

#### Error Responses

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ error }` | Sin fichero, fichero no `.xlsx` o rechazado por `readSafeXlsxUpload` |
| 400 | `{ error: "El libro tiene errores.", details: string[] }` | Errores de validación; cada detalle empieza por `Fila N:` |
| 401 | `{ error }` | Sin sesión |
| 403 | `{ error }` | No admin, o cuenta bloqueada |
| 500 | `{ error }` | Error inesperado |

---

### Cambio en `POST /api/import` (existente)

Con `replace=true`, el `requirementTemplate.deleteMany()` falla con P2003 si algún requisito está vinculado a una plantilla documental (`onDelete: Restrict`). Hoy eso sería un 500 genérico.

**Nuevo**: el P2003 se traduce a **409** con `{ error: "No se puede reemplazar el catálogo de requisitos: hay plantillas documentales que justifican algunos de ellos." }`. El resto de la ruta no cambia.

---

## TypeScript Types (canonical)

```typescript
// services/document-template.types.ts
export const FASES_ORDEN = [
  "oferta", "contratacion", "movilizacion", "produccion", "entrega", "cierre",
] as const;
export type Fase = (typeof FASES_ORDEN)[number];

export const FASE_ETIQUETA: Record<Fase, string> = {
  oferta: "Oferta", contratacion: "Contratación", movilizacion: "Movilización",
  produccion: "Producción", entrega: "Entrega", cierre: "Cierre",
};

export const PROJECT_ROLES = ["adjudicador", "adjudicatario_principal", "adjudicatario"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const FORMATOS = ["docx", "xlsx"] as const;
export const TIPOS = ["iso", "administrativa", "ambas"] as const;

// Fila del libro ya normalizada por el parser (antes de resolver requisitos)
export type ParsedDocumentTemplateRow = {
  fila: number;
  fichero: string;
  nombre: string;
  formato: (typeof FORMATOS)[number];
  vigente: boolean;
  roles: ProjectRole[];
  fase: Fase;
  obligatoria: boolean;
  tipo: (typeof TIPOS)[number];
  referencias: { norma: string; item: string }[];
};
```

---

## Service Layer

```
app/lib/documentTemplateImport.ts            ← parser puro del libro (sin BD): normaliza y valida forma
services/document-template.types.ts          ← tipos y constantes
services/document-template.service.ts        ← importacion (resolucion de requisitos, transaccion,
                                                versiones), listado aplicable, resolucion del fichero
app/api/projects/[id]/document-templates/route.ts
app/api/projects/[id]/document-templates/[templateId]/file/route.ts
app/api/admin/document-templates/import/route.ts
```

Los handlers solo autentican, validan la entrada, llaman al servicio y formatean. La comprobación de pertenencia del proyecto vive en el servicio (reutiliza el criterio de `findProjectForActor`).

---

## BAOS Compliance Checklist

- [x] Las tres rutas exigen sesión.
- [x] El acceso a datos de proyecto se acota por `userId` (dueño) o admin; lo ajeno es 404.
- [x] La ruta de importación está bajo `/api/admin/` y comprueba `isAdminRole`.
- [x] Las mutaciones del catálogo crean `DocumentTemplateVersion` en la misma transacción.
- [x] Ninguna respuesta expone datos de otro tenant (el catálogo es global y no tiene datos de cliente).
- [x] Los mensajes no filtran estructura interna: `fichero` y rutas de disco no salen en respuestas de usuario.
- [x] Sin operaciones en bloque que salten el filtro de tenant.

---

## Integration Notes

- **Listado y descarga**: los consume `app/projects/[id]/ProjectDocumentsSection.tsx` (componente nuevo, fuera de `ProjectClient.tsx`), colocado después del listado de requisitos.
- **Importación**: la consume un bloque nuevo en `app/admin/AdminPanelClient.tsx`.
- **`next.config.js`**: entradas de `outputFileTracingIncludes` para la ruta de descarga y la de importación (ADR-016 D1).
- **`tests/helpers/db.ts`** (`cleanupTenant`) y `scripts/clean-test-tenants.mjs`: no cambian, porque el catálogo no pertenece a un tenant. Los tests del importador usan plantillas **SYNTHETIC TEST DATA** con prefijo `SYNTHETIC-` en `fichero`. Para que la comprobación de existencia del fichero no dependa del repositorio, el servicio recibe el directorio de plantillas como parámetro (por defecto `docs/fuentes/plantillas-iso/`) y los tests le pasan un directorio temporal con ficheros sintéticos. Los tests borran sus propias plantillas (vínculos y versiones primero, por la FK): es el único código que borra una `DocumentTemplate`.

## Open Questions

Ninguna para la entrega 1.
