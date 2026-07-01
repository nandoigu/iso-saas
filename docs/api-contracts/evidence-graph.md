# API Contract: Evidence Graph

> BAOS Component: Evidence Graph
> Domain Model: docs/domain-models/evidence-graph.md
> Component Spec: docs/component-specs/evidence-graph.md
> ADR: docs/adr/ADR-003-evidence-graph-phase1-scoping.md
> Phase: Phase 1 — Technological Foundation
> Date: 2026-07-01
> Status: Draft

## Summary

Esta API expone el registro, edición, validación y vinculación de evidencias (`EvidenceItem`) que sustentan el cumplimiento ISO 19650 de un proyecto. El propietario del proyecto sube y mantiene sus evidencias; solo `admin` puede validarlas, vincularlas a un requisito normativo específico, o citarlas como base de conclusión en un `AuditReport`. Sin esta separación, una evidencia no validada podría filtrarse a un informe firmado, violando el principio evidence-first.

El acceso a los binarios (`sourceRef`) se sirve exclusivamente vía signed URL de corta duración (ADR-003, decisión #1) — nunca como URL pública directa.

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

### `POST /api/evidence/[evidenceId]/requirement-links`

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

### `DELETE /api/evidence/[evidenceId]/requirement-links/[linkId]`

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
- `auditReport.status` no puede ser `final` (invariant #7) — 409 en caso contrario
- Único por `[evidenceItemId, auditReportId]` — 409 si ya existe el vínculo

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
| 409 | Evidencia no validada, informe `final`, o vínculo ya existente |

---

### `GET /api/admin/evidence/[evidenceId]/file`

**Purpose**: Obtener una signed URL de corta duración para acceder al archivo fuente de la evidencia (ADR-003, decisión #1).
**Auth**: Required
**RBAC**: `user` (dueño) | `admin`
**Tenant scope**: Verifica pertenencia de la evidencia al tenant

#### Response — 200 OK

```typescript
type GetEvidenceFileResponse = {
  url: string;       // signed URL de Vercel Blob
  expiresAt: string; // ISO 8601 — vencimiento de la URL
};
```

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
- [x] `EvidenceReportLink` bloqueado si la evidencia no está `validated` o el informe es `final` (invariants #2, #7)
- [x] `DELETE` bloqueado si existen `EvidenceReportLink` (invariant #3)
- [x] Acceso a archivo fuente solo vía signed URL de corta duración, nunca URL pública (ADR-003)
- [x] Respuestas de error usan 404 (no 403) para recursos fuera del tenant del usuario
- [ ] Cifrado adicional de `sourceRef`/`snapshot` — pendiente decisión en security-spec

---

## Service Layer

```
app/api/projects/[projectId]/evidence/route.ts                       ← GET (list), POST (create)
app/api/evidence/[evidenceId]/route.ts                                ← GET, PATCH, DELETE
app/api/evidence/[evidenceId]/requirement-links/route.ts             ← POST
app/api/evidence/[evidenceId]/requirement-links/[linkId]/route.ts    ← DELETE
app/api/admin/evidence/[evidenceId]/validate/route.ts                 ← POST
app/api/admin/evidence/[evidenceId]/report-links/route.ts             ← POST
app/api/admin/evidence/[evidenceId]/file/route.ts                     ← GET (signed URL)

services/evidence.service.ts    ← Toda la lógica de negocio + Prisma calls + invariants
services/evidence.types.ts      ← Tipos TypeScript canónicos (ver sección anterior)
```

Los route handlers son thin: autentican, validan el shape del input y delegan al servicio. Las invariants del domain model (#1–#8) se aplican exclusivamente en `evidence.service.ts`, siguiendo el mismo patrón que `audit-team.service.ts`.

---

## Integration Notes

**Prisma models**: `EvidenceItem`, `EvidenceRequirementLink`, `EvidenceReportLink`, `EvidenceValidation`, `EvidenceItemVersion` (nuevos) + back-relations en `Project`, `Requirement`, `AuditReport`, `User` (ver domain model, sección "Back-relations required").

**Project**: `EvidenceItem.projectId → Project.id`. El tenant scope reutiliza el mismo patrón que `app/api/requirements/route.ts` (`project.userId === user.id`, con bypass para `admin`).

**Requirement**: `EvidenceRequirementLink.requirementId → Requirement.id`. El campo legado `Requirement.evidencia` (texto libre) no se toca en este contrato (ADR-003, decisión #4).

**AuditReport**: `EvidenceReportLink.auditReportId → AuditReport.id`. Esta API no reemplaza el campo `AuditReport.traceability Json` existente en Phase 1 — coexisten hasta el backfill de Phase 2.

**Storage**: `EvidenceItem.sourceRef` almacena el `pathname` de Vercel Blob (store privado). La subida del binario ocurre fuera de este contrato (flujo de upload directo a Blob desde el cliente o una ruta de upload dedicada, a definir en implementación); este contrato solo persiste la referencia y sirve el acceso vía `GET .../file`.

**Frontend**: En Phase 1 no existe UI dedicada de Evidence Graph. `/projects/[id]` es el candidato natural para listar/subir evidencia del proyecto; `/admin/audit-reports` es el candidato para las acciones de validación y vinculación a informe.

---

## Open Questions

1. **Endpoint de upload del binario** — este contrato asume que el cliente sube el archivo directamente a Vercel Blob (client upload) y luego envía el `pathname` resultante a `POST .../evidence` o `PATCH .../evidence/[id]`. Falta definir si se usa `handleUpload` de `@vercel/blob/client` con un token de cliente, o una ruta server-side intermedia. Se resuelve en implementación, no bloquea el contrato.
2. **Notificación efectiva al Contradiction Engine** — el contrato deja el side effect de `linkType = contradictory` como una simple transición de estado (ADR-003). Cuando el Contradiction Engine exista, puede requerir un campo adicional de correlación; no se anticipa aquí.
