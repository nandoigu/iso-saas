# API Contract: Evidence Graph

> BAOS Component: Evidence Graph
> Domain Model: docs/domain-models/evidence-graph.md
> Component Spec: docs/component-specs/evidence-graph.md
> ADR: docs/adr/ADR-003-evidence-graph-phase1-scoping.md · docs/adr/ADR-004-evidence-graph-implementation-decisions.md
> Phase: Phase 1 — Technological Foundation
> Date: 2026-07-01 (revisado 2026-08-05 — ADR-004; corregido 2026-08-06 — invariant #7)
> Status: Draft

> **Corrección 2026-08-06 (invariant #7)**: este contrato definía el bloqueo de citas
> contra `AuditReport.status = "final"`. **Ese valor no existe en la implementación**:
> los estados que marcan un informe cerrado son `signed` y `finalizado`, como ya
> recogía `docs/domain-models/audit-team.md` y como comprueba `audit-team.service.ts`.
> Escrita al pie de la letra, la invariante nunca se habría disparado y un informe
> firmado habría aceptado citas nuevas mientras la checklist afirmaba lo contrario.
> Corregido aquí; ver `IMMUTABLE_AUDIT_REPORT_STATUSES` en `services/evidence.types.ts`.

## Summary

Esta API expone el registro, edición, validación y vinculación de evidencias (`EvidenceItem`) que sustentan el cumplimiento ISO 19650 de un proyecto. El propietario del proyecto sube y mantiene sus evidencias; solo `admin` puede validarlas, vincularlas a un requisito normativo específico, o citarlas como base de conclusión en un `AuditReport`. Sin esta separación, una evidencia no validada podría filtrarse a un informe firmado, violando el principio evidence-first.

El acceso a los binarios (`sourceRef`) se sirve exclusivamente vía signed URL de corta duración (ADR-003, decisión #1) — nunca como URL pública directa. La escritura del binario ocurre por client upload directo al store, autorizada por un token que emite el servidor (ADR-004, decisión #3).

**Convención de rutas (ADR-004, decisión #2)**: toda ruta bajo `/api/admin/` exige `role === 'admin'`, sin excepciones. Una ruta que no cuelga de ese prefijo no lo exige. El control se sigue aplicando en el route handler; el prefijo es una garantía estructural legible, no el mecanismo.

Son 12 endpoints en total.

---

## Endpoints

### `GET /api/projects/[projectId]/evidence`

**Purpose**: Listar las evidencias de un proyecto.
**Auth**: Required — `getAuthSession(req)`
**RBAC**: `user` (dueño del proyecto) | `admin`
**Tenant scope**: `project.userId === user.id`, o cualquier proyecto si `admin`

#### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | `string` | No | `draft`, `submitted`, `under_review`, `validated`, `rejected`, `archived` |
| `requirementId` | `string` | No | Filtrar evidencias vinculadas a un requisito concreto |

#### Response — 200 OK

```typescript
type ListEvidenceResponse = {
  data: EvidenceItemSummary[];
};

type EvidenceItemSummary = {
  id: string;
  projectId: string;
  title: string;
  type: string;   // document | record | declaration
  status: string; // draft | submitted | under_review | validated | rejected | archived
  version: number;
  createdAt: string; // ISO 8601
  createdBy: string;
};
```

#### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | Sin sesión válida |
| 404 | Proyecto no encontrado en el tenant del usuario |
| 500 | Error inesperado del servidor |

---

### `POST /api/projects/[projectId]/evidence`

**Purpose**: Registrar una nueva evidencia en estado `draft`.
**Auth**: Required
**RBAC**: `user` (dueño del proyecto) | `admin`
**Tenant scope**: `projectId` de la ruta, verificado contra el proyecto del usuario

#### Request Body

```typescript
type CreateEvidenceRequest = {
  title: string;                                  // requerido
  description?: string;
  type: 'document' | 'record' | 'declaration';    // requerido
  sourceRef?: string;                              // pathname de Vercel Blob (ver POST .../file)
};
```

#### Validation Rules

- `title`: requerido, max 255 chars
- `type`: requerido, uno de `document | record | declaration`
- `status`: no se acepta del body — siempre inicia en `draft`

#### Response — 201 Created

```typescript
type CreateEvidenceResponse = {
  data: EvidenceItemSummary;
};
```

#### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | `title` o `type` ausentes/inválidos |
| 401 | Sin sesión válida |
| 404 | Proyecto no encontrado en el tenant del usuario |
| 500 | Error del servidor |

---

### `GET /api/evidence/[evidenceId]`

**Purpose**: Obtener el detalle completo de una evidencia, incluyendo vínculos, validaciones y versiones.
**Auth**: Required
**Tenant scope**: `evidenceItem.project.userId === user.id`, o cualquiera si `admin` — 404 si no pertenece al tenant

#### Response — 200 OK

```typescript
type GetEvidenceResponse = {
  data: EvidenceItemDetail;
};

type EvidenceItemDetail = EvidenceItemSummary & {
  description: string;
  sourceRef: string | null;
  updatedAt: string;
  updatedBy: string | null;
  requirementLinks: EvidenceRequirementLinkSummary[];
  reportLinks: EvidenceReportLinkSummary[];
  validations: EvidenceValidationSummary[];
};

type EvidenceRequirementLinkSummary = {
  id: string;
  requirementId: string;
  linkType: string; // primary | supporting | contradictory
  addedAt: string;
  addedBy: string;
  // ADR-010: null mientras el vinculo solo este declarado. Un vinculo sin validar
  // no puede sustentar una conclusion como evidencia validada.
  validatedAt: string | null;
  validatedBy: string | null;
};

type EvidenceReportLinkSummary = {
  id: string;
  auditReportId: string;
  usedAs: string; // supporting | conclusion_basis | referenced
  addedAt: string;
  addedBy: string;
};

type EvidenceValidationSummary = {
  id: string;
  outcome: string; // approved | rejected | pending_clarification
  notes: string;
  validatedAt: string;
  validatedBy: string;
};
```

#### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | Sin sesión válida |
| 404 | Evidencia no encontrada en el tenant |

---

### `PATCH /api/evidence/[evidenceId]`

**Purpose**: Actualizar el contenido de una evidencia (título, descripción, referencia de archivo).
**Auth**: Required
**RBAC**: `user` (dueño) | `admin`
**Tenant scope**: Verifica pertenencia antes de actualizar

#### Request Body

```typescript
type UpdateEvidenceRequest = Partial<{
  title: string;
  description: string;
  sourceRef: string;
}>;
// status, version, projectId NO son actualizables por esta vía — status cambia solo vía
// POST .../validate o el reset automático por invariant #6 (contradicción)
```

#### Validation Rules

- Bloqueado si `status ∈ {validated, archived}` — evidencia validada o archivada es inmutable por esta vía (409). Para corregir una evidencia validada, debe pasar primero por una nueva validación con `outcome = rejected` o `pending_clarification`.
- **Al menos uno de `title`, `description` o `sourceRef` debe venir en el body (400).** Un `PATCH` sin campos de contenido no es un no-op inocuo: incrementaría `version` y escribiría un snapshot idéntico al anterior, ensuciando el audit trail e inflando el número de versión sin cambio real. La regla se aplica en el handler y también en el servicio, que es donde viven las demás invariantes del componente.
- `title`, si viene, no puede quedar vacío tras `trim()` (400), ni superar 255 caracteres (400).

#### Side Effects

- Crea un snapshot en `EvidenceItemVersion` (invariant #4/#5 del domain model) e incrementa `EvidenceItem.version`.
- Si el `status` era `rejected`, se resetea a `submitted` (reingresa al flujo de validación).

#### Response — 200 OK

Devuelve la evidencia actualizada en el mismo shape que `GET /api/evidence/[evidenceId]`.

#### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Validación fallida |
| 401 | Sin sesión válida |
| 404 | Evidencia no encontrada en el tenant |
| 409 | Evidencia `validated` o `archived` — inmutable por esta vía |

---

### `DELETE /api/evidence/[evidenceId]`

**Purpose**: Eliminar una evidencia que no ha sido citada en ningún informe.
**Auth**: Required
**RBAC**: `user` (dueño) | `admin`
**Tenant scope**: Verifica pertenencia antes de eliminar

#### Deletion strategy

- [x] Hard delete si no tiene `EvidenceReportLink` asociados
- [ ] Soft delete — no aplica; se usa `status = archived` para evidencia que ya no debe eliminarse (ver invariant #3)
- [x] Cascade: `EvidenceRequirementLink`, `EvidenceValidation`, `EvidenceItemVersion` (definido `onDelete: Cascade` en el domain model)
- [x] Restrict: bloqueado si existen `EvidenceReportLink` (invariant #3 — evidencia citada en un informe es inmutable)

#### Response — 200 OK

```typescript
type DeleteEvidenceResponse = {
  deleted: true;
  id: string;
};
```

#### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | Sin sesión válida |
| 404 | Evidencia no encontrada en el tenant |
| 409 | Evidencia citada en un `AuditReport` — usar `status = archived` en su lugar |

---

### `POST /api/evidence/[evidenceId]/submit`

**Purpose**: Declarar una evidencia lista para revisión — transición `draft → submitted` (ADR-004, decisión #1).
**Auth**: Required
**RBAC**: `user` (dueño) | `admin` — presentar la evidencia es un acto del auditado, no del auditor
**Tenant scope**: Verifica pertenencia de la evidencia al tenant

#### Request Body

Sin body.

#### Validation Rules

- `status` debe ser `draft` — cualquier otro estado devuelve 409. La reentrada al flujo desde `rejected` la gestiona `PATCH` como efecto lateral, no este endpoint.

#### Side Effects

- `EvidenceItem.status → submitted`. No crea `EvidenceItemVersion`: no cambia el contenido, solo su disponibilidad para revisión.

#### Response — 200 OK

```typescript
type SubmitEvidenceResponse = {
  data: EvidenceItemSummary;
};
```

#### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | Sin sesión válida |
| 404 | Evidencia no encontrada en el tenant |
| 409 | `status` distinto de `draft` |

---

### `POST /api/projects/[projectId]/evidence/upload-token`

**Purpose**: Emitir el token firmado que autoriza al cliente a subir un binario directamente al store de Vercel Blob (ADR-004, decisión #3).
**Auth**: Required
**RBAC**: `user` (dueño del proyecto) | `admin` — misma autorización que `POST .../evidence`
**Tenant scope**: `project.userId === user.id`, o cualquier proyecto si `admin`

Este endpoint es el punto crítico de seguridad del flujo de subida: es donde se verifican sesión, rol y pertenencia del proyecto **antes** de conceder escritura en el store. El binario nunca atraviesa la función serverless, evitando el límite de ~4,5 MB del body.

#### Request Body

El payload del handshake de client upload de `@vercel/blob/client` (`HandleUploadBody`). El contrato exige únicamente que el `pathname` autorizado quede bajo un prefijo que incluya el `projectId`, para que un archivo huérfano sea siempre atribuible a su proyecto.

**Fijado en implementación (2026-08-16, `@vercel/blob@2.8.0`)**: prefijo `evidence/{projectId}/`, comprobado en `onBeforeGenerateToken` antes de emitir nada. El token resultante queda además acotado al pathname por el propio SDK — un `put` a otra ruta con ese token falla con `Pathname mismatch` (verificado contra el store real). Restricciones aplicadas: `maximumSizeInBytes` de 200 MB y `addRandomSuffix: true`. **Sin lista blanca de `contentType`**: los formatos BIM (IFC, DWG, RVT) llegan con MIME inconsistente o vacío y una lista blanca rechazaría evidencia legítima.

⚠️ **El `access` no lo decide este endpoint**: en este handshake lo declara el cliente en su llamada a `upload()`. Lo que impide publicar una evidencia es que el store `iso-saas-evidence-fra` está **configurado como privado** y rechaza toda escritura pública (`Cannot use public access on a private store`). Es una garantía de infraestructura, no de código: un store creado sin acceso privado dejaría esta ruta sin esa protección.

#### Response — 200 OK

La respuesta del handshake de client upload. El cliente recibe el `pathname` resultante al completar la subida y lo envía como `sourceRef` a `POST .../evidence` o `PATCH /api/evidence/[evidenceId]`.

#### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | El `pathname` solicitado cae fuera del prefijo del proyecto — denegación, no fallo del servidor |
| 401 | Sin sesión válida |
| 404 | Proyecto no encontrado en el tenant del usuario |
| 500 | `BLOB_READ_WRITE_TOKEN` ausente o inválido |

---

### `POST /api/projects/[projectId]/requirements/[requirementId]/evidence-links`

**Purpose**: El dueño del proyecto **declara** que una evidencia ya subida sustenta este requisito.
Es una aportación, no una certificación: el vínculo nace **sin validar** (ADR-010).
**Auth**: Required — `getAuthSession(req)`
**RBAC**: dueño del proyecto **o** `admin`. No vive bajo `/api/admin/` y por tanto **no** lleva
`isAdminRole`: ADR-010 acota el punto #2 de ADR-004 separando declarar de validar.
**Tenant scope**: `assertProjectAccess(projectId, actor)` — 404 si el proyecto no es del usuario

#### Request Body

```typescript
type DeclareLinkRequest = {
  evidenceItemId: string;
  linkType?: 'primary' | 'supporting'; // por defecto 'supporting'
};
```

#### Validation Rules

- `evidenceItemId`: obligatorio, no vacío.
- La evidencia y el requisito deben pertenecer **al mismo proyecto** de la ruta (ADR-003 #2).
- `linkType`: **`contradictory` se rechaza con 403.** Declarar un documento como contradictorio
  es un juicio sobre el cumplimiento, no una afirmación sobre la intención del aportante, y
  además fuerza la evidencia a `under_review`. Por el criterio de ADR-010 ese acto es del
  auditor y se queda en la ruta admin.

#### Side Effects

- Crea el `EvidenceRequirementLink` con `addedBy = user.id`, `validatedAt = null` y
  `validatedBy = null`. **Ninguna** transición de estado de la evidencia.

#### Response — 201 Created

```typescript
type DeclareLinkResponse = {
  data: EvidenceRequirementLinkSummary; // validatedAt y validatedBy siempre null aquí
};
```

#### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Falta `evidenceItemId`, o `linkType` no reconocido |
| 401 | Sin sesión válida |
| 403 | `linkType = contradictory` — reservado al auditor |
| 404 | Proyecto ajeno al usuario, evidencia inexistente, o requisito fuera del proyecto |
| 409 | Esa evidencia ya está vinculada a ese requisito |

---
### `POST /api/admin/evidence/[evidenceId]/requirement-links`

**Purpose**: Vincular una evidencia a un requisito ISO 19650, tipando la naturaleza del vínculo.
**Auth**: Required
**RBAC**: `admin` only — el vínculo normativo es criterio de auditor, no del dueño del proyecto
**Tenant scope**: Verifica que `evidenceId` y `requirementId` pertenezcan al mismo proyecto/tenant

#### Request Body

```typescript
type AddRequirementLinkRequest = {
  requirementId: string;                                  // requerido
  linkType?: 'primary' | 'supporting' | 'contradictory';  // default: 'supporting'
};
```

#### Validation Rules

- `requirementId`: requerido, debe existir y pertenecer al mismo `projectId` que la evidencia
- Único por `[evidenceItemId, requirementId]` — 409 si ya existe el vínculo

#### Side Effects

- **El vínculo nace validado**: `validatedBy = user.id` y `validatedAt = now()`, sellados en
  la misma escritura que el `create`. ADR-010 deja la validación en el ámbito admin, y que
  el auditor cree el vínculo es en sí mismo el acto certificante. La alternativa —crear aquí
  y validar en un segundo paso— dejaba vínculos admin inertes, indistinguibles de una
  declaración del dueño del proyecto.
- El acto lo define **la ruta, no el rol**: un admin que use la ruta de declaración
  (`/api/projects/.../evidence-links`) está aportando, no certificando, y ese vínculo nace
  sin validar.
- Si `linkType = contradictory`: transiciona `EvidenceItem.status` a `under_review` y notifica al Contradiction Engine vía el flag de estado (ADR-003, decisión #3 — sin cola ni tabla de trigger en Phase 1).

#### Response — 201 Created

```typescript
type AddRequirementLinkResponse = {
  data: EvidenceRequirementLinkSummary;
};
```

#### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | `requirementId` ausente o `linkType` inválido |
| 401 | Sin sesión válida |
| 403 | Usuario no es admin |
| 404 | Evidencia o requisito no encontrado en el tenant |
| 409 | Vínculo ya existe |

---

### `DELETE /api/admin/evidence/[evidenceId]/requirement-links/[linkId]`

**Purpose**: Eliminar un vínculo evidencia-requisito.
**Auth**: Required
**RBAC**: `admin` only
**Tenant scope**: Verifica pertenencia del vínculo al tenant

#### Response — 200 OK

```typescript
type DeleteLinkResponse = {
  deleted: true;
  id: string;
};
```

#### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | Sin sesión válida |
| 403 | Usuario no es admin |
| 404 | Vínculo no encontrado en el tenant |

---

### `POST /api/admin/evidence/[evidenceId]/validate`

**Purpose**: Registrar una decisión de validación humana sobre una evidencia (aprobar, rechazar, o solicitar aclaración).
**Auth**: Required
**RBAC**: `admin` only — la validación humana es un punto de control obligatorio (invariant #1 del domain model)
**Tenant scope**: Verifica pertenencia de la evidencia al tenant

#### Request Body

```typescript
type ValidateEvidenceRequest = {
  outcome: 'approved' | 'rejected' | 'pending_clarification'; // requerido
  notes?: string;
};
```

#### Validation Rules

- `outcome`: requerido, uno de los tres valores
- Bloqueado si `status ∈ {archived}` — no se valida evidencia archivada (409)

#### Side Effects

- Crea un registro `EvidenceValidation` con `validatedBy = user.id` (no nulo — invariant human-in-the-loop)
- Si `outcome = approved`: `EvidenceItem.status → validated`
- Si `outcome = rejected`: `EvidenceItem.status → rejected`
- Si `outcome = pending_clarification`: `EvidenceItem.status → under_review`

#### Response — 201 Created

```typescript
type ValidateEvidenceResponse = {
  data: EvidenceValidationSummary;
  evidenceStatus: string; // status resultante de EvidenceItem
};
```

#### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | `outcome` ausente o inválido |
| 401 | Sin sesión válida |
| 403 | Usuario no es admin |
| 404 | Evidencia no encontrada en el tenant |
| 409 | Evidencia `archived` — no se puede validar |

---

### `POST /api/admin/evidence/[evidenceId]/report-links`

**Purpose**: Citar una evidencia validada como soporte o base de conclusión de un `AuditReport`.
**Auth**: Required
**RBAC**: `admin` only
**Tenant scope**: Verifica que evidencia y `AuditReport` pertenezcan al mismo tenant

#### Request Body

```typescript
type AddReportLinkRequest = {
  auditReportId: string;                                          // requerido
  usedAs?: 'supporting' | 'conclusion_basis' | 'referenced';      // default: 'supporting'
};
```

#### Validation Rules

- `evidenceItem.status` debe ser `validated` (invariant #2) — 409 en caso contrario
- `auditReport.status` no puede ser `signed` ni `finalizado` (invariant #7) — 409 en caso contrario
- Único por `[evidenceItemId, auditReportId]` — 409 si ya existe el vínculo
- **`usedAs = conclusion_basis`**: si la evidencia tiene vínculos de requisito y **ninguno**
  está validado, 409 (ADR-010, riesgo declarado). Un vínculo que solo declaró el dueño del
  proyecto no puede sustentar una conclusión.

> ⚠️ **Guarda gruesa y hueco conocido.** La comprobación verifica que *exista* aval de auditor,
> no que sea del requisito concreto: `EvidenceReportLink` no tiene dimensión de requisito porque
> el informe es de proyecto. La versión exacta llega con el hallazgo por requisito (ADR-011), y
> entonces esta se mantiene como red de seguridad, no se sustituye.
>
> Además, la guarda **no alcanza a la evidencia sin ningún vínculo de requisito**: eso era legal
> antes de ADR-010 (lo fija HP-09) y prohibirlo sería una regla nueva que ningún ADR autoriza.
> Queda como decisión pendiente, no como descuido.

#### Response — 201 Created

```typescript
type AddReportLinkResponse = {
  data: EvidenceReportLinkSummary;
};
```

#### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | `auditReportId` ausente |
| 401 | Sin sesión válida |
| 403 | Usuario no es admin |
| 404 | Evidencia o informe no encontrado en el tenant |
| 409 | Evidencia no validada, informe cerrado (`signed`/`finalizado`), o vínculo ya existente |

---

### `GET /api/evidence/[evidenceId]/file`

**Purpose**: Obtener una signed URL de corta duración para acceder al archivo fuente de la evidencia (ADR-003, decisión #1).
**Auth**: Required
**RBAC**: `user` (dueño) | `admin` — un dueño que no pudiera abrir su propio documento no tendría forma de verificar qué presentó. Por eso esta ruta no cuelga de `/api/admin/` (ADR-004, decisión #2)
**Tenant scope**: Verifica pertenencia de la evidencia al tenant

#### Response — 200 OK

```typescript
type GetEvidenceFileResponse = {
  url: string;       // signed URL de Vercel Blob
  expiresAt: string; // ISO 8601 — vencimiento de la URL
};
```

**Fijado en implementación (2026-08-16)**: la URL se produce con `issueSignedToken` + `presignUrl` (`operation: 'get'`, `access: 'private'`), ambos acotados al mismo `validUntil`. **TTL de 5 minutos** — ADR-003 decía "corta duración" sin fijar número; cinco minutos bastan para abrir o descargar y dejan poca ventana si la URL se filtra por historial, proxy o captura. El `access: 'private'` entra en la cadena firmada del lado del servidor: quien reciba la URL no puede cambiarlo.

#### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | Sin sesión válida |
| 404 | Evidencia no encontrada en el tenant, o `sourceRef` vacío |

---

## TypeScript Types (canonical)

```typescript
// Copiar a services/evidence.types.ts

export type EvidenceType = 'document' | 'record' | 'declaration';
export type EvidenceStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'validated'
  | 'rejected'
  | 'archived';
export type EvidenceRequirementLinkType = 'primary' | 'supporting' | 'contradictory';
export type EvidenceReportLinkUsage = 'supporting' | 'conclusion_basis' | 'referenced';
export type EvidenceValidationOutcome = 'approved' | 'rejected' | 'pending_clarification';

export type EvidenceItem = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  type: EvidenceType;
  sourceRef: string | null;
  status: EvidenceStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string | null;
};

export type EvidenceRequirementLink = {
  id: string;
  evidenceItemId: string;
  requirementId: string;
  linkType: EvidenceRequirementLinkType;
  addedAt: Date;
  addedBy: string;
};

export type EvidenceReportLink = {
  id: string;
  evidenceItemId: string;
  auditReportId: string;
  usedAs: EvidenceReportLinkUsage;
  addedAt: Date;
  addedBy: string;
};

export type EvidenceValidation = {
  id: string;
  evidenceItemId: string;
  outcome: EvidenceValidationOutcome;
  notes: string;
  validatedAt: Date;
  validatedBy: string;
};

export type EvidenceItemVersion = {
  id: string;
  evidenceItemId: string;
  version: number;
  snapshot: Record<string, unknown>;
  changeReason: string;
  createdAt: Date;
  createdBy: string;
};

export type CreateEvidenceItemInput = {
  projectId: string;
  title: string;
  description?: string;
  type: EvidenceType;
  sourceRef?: string;
  createdBy: string;
};

export type UpdateEvidenceItemInput = Partial<
  Pick<EvidenceItem, 'title' | 'description' | 'sourceRef'>
> & {
  updatedBy: string;
};

export type AddEvidenceRequirementLinkInput = {
  evidenceItemId: string;
  requirementId: string;
  linkType?: EvidenceRequirementLinkType;
  addedBy: string;
};

export type AddEvidenceReportLinkInput = {
  evidenceItemId: string;
  auditReportId: string;
  usedAs?: EvidenceReportLinkUsage;
  addedBy: string;
};

export type CreateEvidenceValidationInput = {
  evidenceItemId: string;
  outcome: EvidenceValidationOutcome;
  notes?: string;
  validatedBy: string;
};
```

---

## BAOS Compliance Checklist

- [x] Todos los endpoints requieren sesión válida (`getAuthSession`)
- [x] Endpoints de lectura/creación/edición de `EvidenceItem`: `user` dueño del proyecto | `admin`
- [x] Endpoints de vinculación normativa, validación y cita en informe: `admin` only (punto de control humano)
- [x] Todas las queries scopeadas vía `project.userId` (o `admin` sin restricción) — mismo patrón que `Requirement`
- [x] `projectId`/`createdBy`/`validatedBy` nunca aceptados desde el body cuando deben inyectarse desde sesión o ruta
- [x] Mutaciones de contenido (`PATCH`) crean snapshot en `EvidenceItemVersion` (governance-first)
- [x] Ninguna transición a `validated`/`rejected` ocurre sin un `EvidenceValidation` con `validatedBy` humano (invariant #1)
- [x] `EvidenceReportLink` bloqueado si la evidencia no está `validated` o el informe está cerrado — `signed`/`finalizado` (invariants #2, #7)
- [x] `DELETE` bloqueado si existen `EvidenceReportLink` (invariant #3)
- [x] Acceso a archivo fuente solo vía signed URL de corta duración, nunca URL pública (ADR-003)
- [x] Respuestas de error usan 404 (no 403) para recursos fuera del tenant del usuario
- [x] Toda ruta bajo `/api/admin/` es admin-only sin excepción (ADR-004 #2)
- [x] La emisión del token de subida verifica sesión, rol y pertenencia del proyecto antes de firmar (ADR-004 #3)
- [x] Cifrado adicional de `sourceRef`/`snapshot` — resuelto en security-spec (open question #1): sin cifrado a nivel de aplicación en Phase 1; Neon y Blob cifran en reposo y la protección efectiva es el control de acceso

---

## Service Layer

```
app/api/projects/[projectId]/evidence/route.ts                             ← GET (list), POST (create)
app/api/projects/[projectId]/evidence/upload-token/route.ts                ← POST (token de client upload)
app/api/evidence/[evidenceId]/route.ts                                      ← GET, PATCH, DELETE
app/api/evidence/[evidenceId]/submit/route.ts                               ← POST (draft → submitted)
app/api/evidence/[evidenceId]/file/route.ts                                 ← GET (signed URL)
app/api/admin/evidence/[evidenceId]/requirement-links/route.ts             ← POST
app/api/admin/evidence/[evidenceId]/requirement-links/[linkId]/route.ts    ← DELETE
app/api/admin/evidence/[evidenceId]/validate/route.ts                       ← POST
app/api/admin/evidence/[evidenceId]/report-links/route.ts                   ← POST

services/evidence.service.ts    ← Toda la lógica de negocio + Prisma calls + invariants
services/evidence.types.ts      ← Tipos TypeScript canónicos (ver sección anterior)
```

9 ficheros de ruta, 12 endpoints. Las rutas bajo `app/api/admin/` son admin-only sin excepción.

Los route handlers son thin: autentican, validan el shape del input y delegan al servicio. Las invariants del domain model (#1–#8) se aplican exclusivamente en `evidence.service.ts`, siguiendo el mismo patrón que `audit-team.service.ts`.

---

## Integration Notes

**Prisma models**: `EvidenceItem`, `EvidenceRequirementLink`, `EvidenceReportLink`, `EvidenceValidation`, `EvidenceItemVersion` (nuevos) + back-relations en `Project`, `Requirement`, `AuditReport`, `User` (ver domain model, sección "Back-relations required").

**Project**: `EvidenceItem.projectId → Project.id`. El tenant scope reutiliza el mismo patrón que `app/api/requirements/route.ts` (`project.userId === user.id`, con bypass para `admin`).

**Requirement**: `EvidenceRequirementLink.requirementId → Requirement.id`. El campo legado `Requirement.evidencia` (texto libre) no se toca en este contrato (ADR-003, decisión #4).

**AuditReport**: `EvidenceReportLink.auditReportId → AuditReport.id`. Esta API no reemplaza el campo `AuditReport.traceability Json` existente en Phase 1 — coexisten hasta el backfill de Phase 2.

**Storage**: `EvidenceItem.sourceRef` almacena el `pathname` de Vercel Blob (store privado **`iso-saas-evidence-fra`** en `fra1`, ya aprovisionado con `BLOB_READ_WRITE_TOKEN` vinculado al proyecto — región cambiada el 2026-08-10 por ADR-007). La escritura del binario es client upload autorizado por `POST /api/projects/[projectId]/evidence/upload-token`; la lectura, signed URL vía `GET /api/evidence/[evidenceId]/file`. El binario nunca atraviesa una función serverless en ninguno de los dos sentidos. Requiere `@vercel/blob` como dependencia — **no instalada todavía**.

**Frontend**: En Phase 1 no existe UI dedicada de Evidence Graph. `/projects/[id]` es el candidato natural para listar/subir evidencia del proyecto; `/admin/audit-reports` es el candidato para las acciones de validación y vinculación a informe.

---

## Open Questions

1. **Endpoint de upload del binario** — ✅ **Resuelto (2026-08-05, ADR-004 decisión #3)**: client upload directo a Vercel Blob, autorizado por `POST /api/projects/[projectId]/evidence/upload-token`, que es donde se aplican sesión, RBAC y tenant. El cliente envía después el `pathname` resultante como `sourceRef`. Se descartó la ruta server-side que recibe el fichero por el límite de ~4,5 MB del body en funciones serverless, incompatible con planos BIM e informes de proyecto. La firma exacta de la API de `@vercel/blob` se verifica en implementación.
2. **Notificación efectiva al Contradiction Engine** — el contrato deja el side effect de `linkType = contradictory` como una simple transición de estado (ADR-003). Cuando el Contradiction Engine exista, puede requerir un campo adicional de correlación; no se anticipa aquí.
