# API Contract: Audit Team

> BAOS Component: Audit Runtime
> Domain Model: docs/domain-models/audit-team.md
> Phase: Phase 1 — Technological Foundation
> Date: 2026-07-01
> Status: Draft

## Summary

Esta API expone la gestión de equipos de auditoría ISO 19650: creación de perfiles de auditor, constitución de equipos por proyecto/engagement, y asignación de miembros con roles formales (`lead_auditor`, `support_auditor`, `technical_expert`). Es consumida por administradores de la plataforma al configurar un engagement de auditoría antes de ejecutar el Audit Runtime. Sin un `AuditTeam` con al menos un `lead_auditor` confirmado, no puede firmarse un `AuditReport`.

El acceso es exclusivamente `admin` — los auditores externos no tienen acceso directo a través de esta API en Phase 1.

---

## Endpoints

### `GET /api/admin/auditors`

**Purpose**: Listar todos los auditores del tenant (activos y suspendidos).
**Auth**: Required — `getAuthSession(req)`
**RBAC**: `admin` only
**Tenant scope**: `companyId` de la sesión autenticada

#### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | `string` | No | Filtrar por status: `active`, `suspended`, `retired` |
| `isExternal` | `boolean` | No | Filtrar auditores externos (`true`) o internos (`false`) |

#### Response — 200 OK

```typescript
type ListAuditorsResponse = {
  data: AuditorSummary[];
};

type AuditorSummary = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  certificationBody: string | null;
  certificationLevel: string | null;
  qualifications: string[];
  isExternal: boolean;
  status: string; // active | suspended | retired
  userId: string | null; // vinculado a usuario de plataforma
  createdAt: string; // ISO 8601
};
```

#### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | Sin sesión válida |
| 403 | Usuario no es admin |
| 500 | Error inesperado del servidor |

---

### `POST /api/admin/auditors`

**Purpose**: Registrar un nuevo auditor (interno o externo) en el tenant.
**Auth**: Required
**RBAC**: `admin` only
**Tenant scope**: `companyId` inyectado desde la sesión — no se acepta del body

#### Request Body

```typescript
type CreateAuditorRequest = {
  name: string;                  // requerido
  email: string;                 // requerido
  phone?: string;
  certificationBody?: string;    // ej. "AENOR", "Bureau Veritas"
  certificationNumber?: string;
  certificationLevel?: string;   // ej. "lead_auditor_iso19011"
  qualifications?: string[];     // especialidades técnicas
  isExternal?: boolean;          // default: false
  notes?: string;
  userId?: string;               // vincular a User existente (auditor interno)
};
```

#### Validation Rules

- `name`: requerido, max 255 chars
- `email`: requerido, formato email válido, único por `companyId`
- `userId`: si se proporciona, debe existir en la BD y pertenecer al mismo `companyId`, y no puede tener ya un `Auditor` asociado

#### Response — 201 Created

```typescript
type CreateAuditorResponse = {
  data: AuditorSummary;
};
```

#### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Campo requerido ausente o inválido |
| 401 | Sin sesión válida |
| 403 | Usuario no es admin |
| 409 | Email ya registrado en este tenant, o userId ya tiene perfil de auditor |
| 500 | Error del servidor |

---

### `GET /api/admin/auditors/[auditorId]`

**Purpose**: Obtener el perfil completo de un auditor, incluyendo sus asignaciones activas.
**Auth**: Required
**RBAC**: `admin` only
**Tenant scope**: Query incluye `companyId = user.companyId` — 404 si no pertenece al tenant

#### Response — 200 OK

```typescript
type GetAuditorResponse = {
  data: AuditorDetail;
};

type AuditorDetail = AuditorSummary & {
  certificationNumber: string | null;
  notes: string | null;
  updatedAt: string;
  createdById: string;
  assignments: AuditTeamMemberSummary[];
};

type AuditTeamMemberSummary = {
  id: string;
  auditTeamId: string;
  role: string; // lead_auditor | support_auditor | technical_expert
  status: string; // invited | confirmed | active | withdrawn | completed
  assignedAt: string;
  confirmedAt: string | null;
  withdrawnAt: string | null;
};
```

#### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | Sin sesión válida |
| 403 | Usuario no es admin |
| 404 | Auditor no encontrado en el tenant |

---

### `PATCH /api/admin/auditors/[auditorId]`

**Purpose**: Actualizar el perfil de un auditor (datos de contacto, certificaciones, status).
**Auth**: Required
**RBAC**: `admin` only
**Tenant scope**: Verifica pertenencia al tenant antes de actualizar

#### Request Body

```typescript
type UpdateAuditorRequest = Partial<{
  name: string;
  phone: string;
  certificationBody: string;
  certificationNumber: string;
  certificationLevel: string;
  qualifications: string[];
  isExternal: boolean;
  notes: string;
  status: string; // active | suspended | retired
}>;
// companyId, id, createdAt, userId NO son actualizables
```

#### Validation Rules

- `status`: si se pasa a `suspended` o `retired`, el servicio verifica que no existan asignaciones en `status ∈ {invited, confirmed, active}` (invariant #4 del domain model)

#### Side Effects

- Ninguna versión snapshoteada — los datos de perfil de auditor no son entidad auditada en Phase 1. Se registra `updatedAt` vía Prisma.

#### Response — 200 OK

Devuelve el auditor actualizado en el mismo shape que `GET /api/admin/auditors/[auditorId]`.

#### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Validación fallida |
| 401 | Sin sesión válida |
| 403 | Usuario no es admin, o intento de suspender auditor con asignaciones activas |
| 404 | Auditor no encontrado en el tenant |

---

### `GET /api/admin/audit-teams`

**Purpose**: Listar todos los equipos de auditoría del tenant.
**Auth**: Required
**RBAC**: `admin` only
**Tenant scope**: `companyId` de la sesión

#### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | `string` | No | Filtrar por proyecto |
| `status` | `string` | No | `forming`, `active`, `completed`, `disbanded` |

#### Response — 200 OK

```typescript
type ListAuditTeamsResponse = {
  data: AuditTeamSummary[];
};

type AuditTeamSummary = {
  id: string;
  projectId: string;
  auditId: string;
  name: string | null;
  status: string; // forming | active | completed | disbanded
  formedAt: string;
  memberCount: number;
  leadAuditor: { id: string; name: string } | null;
};
```

---

### `POST /api/admin/audit-teams`

**Purpose**: Constituir un nuevo equipo de auditoría para un proyecto/engagement.
**Auth**: Required
**RBAC**: `admin` only
**Tenant scope**: `companyId` inyectado desde sesión; `projectId` se valida que pertenezca al tenant

#### Request Body

```typescript
type CreateAuditTeamRequest = {
  projectId: string;   // requerido — proyecto auditado
  auditId: string;     // requerido — identificador del engagement (coincide con AuditReport.auditId)
  name?: string;       // nombre descriptivo del equipo
};
```

#### Validation Rules

- `projectId`: requerido, debe existir y pertenecer al tenant del admin
- `auditId`: requerido, max 100 chars

#### Response — 201 Created

```typescript
type CreateAuditTeamResponse = {
  data: AuditTeamDetail;
};
```

#### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | `projectId` o `auditId` ausentes |
| 401 | Sin sesión válida |
| 403 | Usuario no es admin |
| 404 | Proyecto no encontrado en el tenant |

---

### `GET /api/admin/audit-teams/[teamId]`

**Purpose**: Obtener el equipo completo con todos sus miembros y estado de cada asignación.
**Auth**: Required
**RBAC**: `admin` only
**Tenant scope**: Verifica `companyId` — 404 si no pertenece al tenant

#### Response — 200 OK

```typescript
type GetAuditTeamResponse = {
  data: AuditTeamDetail;
};

type AuditTeamDetail = {
  id: string;
  companyId: string;
  projectId: string;
  auditId: string;
  name: string | null;
  status: string;
  formedAt: string;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  members: AuditTeamMemberDetail[];
};

type AuditTeamMemberDetail = {
  id: string;
  auditorId: string;
  auditor: {
    id: string;
    name: string;
    email: string;
    certificationLevel: string | null;
    isExternal: boolean;
  };
  role: string; // lead_auditor | support_auditor | technical_expert
  status: string; // invited | confirmed | active | withdrawn | completed
  assignedAt: string;
  confirmedAt: string | null;
  withdrawnAt: string | null;
  withdrawnReason: string | null;
  notes: string | null;
};
```

---

### `PATCH /api/admin/audit-teams/[teamId]`

**Purpose**: Actualizar metadatos del equipo (nombre, status).
**Auth**: Required
**RBAC**: `admin` only
**Tenant scope**: Verifica pertenencia al tenant

#### Request Body

```typescript
type UpdateAuditTeamRequest = Partial<{
  name: string;
  status: string; // forming | active | completed | disbanded
}>;
```

#### Validation Rules

- `status = disbanded`: el servicio verifica que no existan `AuditReport` con `status = signed` vinculados a este equipo (invariant #5 del domain model)

#### Response — 200 OK

Devuelve el equipo en el mismo shape que `GET /api/admin/audit-teams/[teamId]`.

---

### `POST /api/admin/audit-teams/[teamId]/members`

**Purpose**: Asignar un auditor a un equipo con un rol específico.
**Auth**: Required
**RBAC**: `admin` only
**Tenant scope**: Verifica que `auditorId` pertenezca al mismo `companyId`

#### Request Body

```typescript
type AddMemberRequest = {
  auditorId: string;                                              // requerido
  role: 'lead_auditor' | 'support_auditor' | 'technical_expert'; // requerido
  notes?: string;
};
```

#### Validation Rules

- `auditorId`: debe existir, pertenecer al tenant, y tener `status = active`
- `role = lead_auditor`: el servicio verifica que no exista ya otro miembro con `role = lead_auditor` y `status ∈ {invited, confirmed, active}` en el mismo equipo (invariant #1)
- `auditorId` único por equipo: `@@unique([auditTeamId, auditorId])` — 409 si ya está asignado

#### Response — 201 Created

```typescript
type AddMemberResponse = {
  data: AuditTeamMemberDetail;
};
```

#### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Campos requeridos ausentes o rol inválido |
| 401 | Sin sesión válida |
| 403 | Usuario no es admin |
| 404 | Equipo o auditor no encontrado en el tenant |
| 409 | Auditor ya asignado al equipo, o ya existe un lead_auditor activo |

---

### `PATCH /api/admin/audit-teams/[teamId]/members/[memberId]`

**Purpose**: Actualizar el estado de una asignación (confirmar, activar, retirar).
**Auth**: Required
**RBAC**: `admin` only
**Tenant scope**: Verifica pertenencia del equipo al tenant

#### Request Body

```typescript
type UpdateMemberRequest = Partial<{
  status: 'confirmed' | 'active' | 'withdrawn' | 'completed';
  withdrawnReason: string;
  notes: string;
}>;
// role NO es actualizable — para cambiar rol: retirar y crear nueva asignación
```

#### Validation Rules

- `status = withdrawn` con `role = lead_auditor`: el servicio verifica que exista ya otro `AuditTeamMember` con `role = lead_auditor` y `status ∈ {confirmed, active}` en el equipo (invariant #3), o rechaza con 409
- `withdrawnReason`: recomendado (no bloqueante) cuando `status = withdrawn`

#### Side Effects

- Actualiza `confirmedAt` cuando `status` cambia a `confirmed`
- Actualiza `withdrawnAt` cuando `status` cambia a `withdrawn`

#### Response — 200 OK

Devuelve el miembro actualizado en el mismo shape que `AuditTeamMemberDetail`.

#### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Status inválido o transición no permitida |
| 401 | Sin sesión válida |
| 403 | Usuario no es admin |
| 404 | Miembro o equipo no encontrado en el tenant |
| 409 | Retirar lead_auditor sin sucesor confirmado |

---

## TypeScript Types (canonical)

```typescript
// Copiar a services/audit-team.types.ts

export type AuditorStatus = 'active' | 'suspended' | 'retired';
export type AuditTeamStatus = 'forming' | 'active' | 'completed' | 'disbanded';
export type AuditTeamMemberRole = 'lead_auditor' | 'support_auditor' | 'technical_expert';
export type AuditTeamMemberStatus = 'invited' | 'confirmed' | 'active' | 'withdrawn' | 'completed';

export type Auditor = {
  id: string;
  companyId: string;
  userId: string | null;
  name: string;
  email: string;
  phone: string | null;
  certificationBody: string | null;
  certificationNumber: string | null;
  certificationLevel: string | null;
  qualifications: string[];
  isExternal: boolean;
  status: AuditorStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
};

export type AuditTeam = {
  id: string;
  companyId: string;
  projectId: string;
  auditId: string;
  name: string | null;
  status: AuditTeamStatus;
  formedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
};

export type AuditTeamMember = {
  id: string;
  auditTeamId: string;
  auditorId: string;
  role: AuditTeamMemberRole;
  status: AuditTeamMemberStatus;
  assignedAt: Date;
  confirmedAt: Date | null;
  withdrawnAt: Date | null;
  withdrawnReason: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
};

export type CreateAuditorInput = {
  companyId: string;
  name: string;
  email: string;
  phone?: string;
  certificationBody?: string;
  certificationNumber?: string;
  certificationLevel?: string;
  qualifications?: string[];
  isExternal?: boolean;
  notes?: string;
  userId?: string;
  createdById: string;
};

export type UpdateAuditorInput = Partial<
  Pick<Auditor, 'name' | 'phone' | 'certificationBody' | 'certificationNumber' | 'certificationLevel' | 'qualifications' | 'isExternal' | 'notes' | 'status'>
>;

export type CreateAuditTeamInput = {
  companyId: string;
  projectId: string;
  auditId: string;
  name?: string;
  createdById: string;
};

export type AddAuditTeamMemberInput = {
  auditTeamId: string;
  auditorId: string;
  role: AuditTeamMemberRole;
  notes?: string;
  createdById: string;
};

export type UpdateAuditTeamMemberInput = {
  status?: Extract<AuditTeamMemberStatus, 'confirmed' | 'active' | 'withdrawn' | 'completed'>;
  withdrawnReason?: string;
  notes?: string;
};
```

---

## BAOS Compliance Checklist

- [x] Todos los endpoints requieren sesión válida (`getAuthSession`)
- [x] Todos los endpoints son `admin` only — no hay acceso de auditor externo en Phase 1
- [x] Todas las queries de datos incluyen scope de tenant (`companyId` de la sesión)
- [x] `companyId` nunca aceptado desde el body — siempre inyectado desde la sesión
- [x] Invariant de lead_auditor único aplicada en la capa de servicio (no solo BD)
- [x] Invariant de lead_auditor no retirable sin sucesor aplicada en PATCH members
- [x] Invariant de auditor activo no suspendible con asignaciones activas
- [x] Respuestas de error nunca exponen datos de otros tenants (404 en lugar de 403 para recursos ajenos)
- [x] `createdById` registrado en todas las entidades creadas (governance trail)
- [ ] Cifrado de `certificationNumber` — pendiente decisión de compliance regulatorio (ver Open Questions)
- [ ] Versionado de `AuditTeam` al vincularse a `AuditReport` firmado — pendiente Phase 2

---

## Service Layer

```
app/api/admin/auditors/route.ts                       ← GET (list), POST (create)
app/api/admin/auditors/[auditorId]/route.ts           ← GET, PATCH
app/api/admin/audit-teams/route.ts                    ← GET (list), POST (create)
app/api/admin/audit-teams/[teamId]/route.ts           ← GET, PATCH
app/api/admin/audit-teams/[teamId]/members/route.ts   ← POST (add member)
app/api/admin/audit-teams/[teamId]/members/[memberId]/route.ts  ← PATCH (update status)

services/audit-team.service.ts    ← Toda la lógica de negocio + Prisma calls
services/audit-team.types.ts      ← Tipos TypeScript canónicos (ver sección anterior)
```

Los route handlers son thin: solo autentican, validan el shape del input y delegan al servicio. Las invariants del domain model (#1, #3, #4, #5) se aplican exclusivamente en `audit-team.service.ts`.

---

## Integration Notes

**Prisma models**: `Auditor`, `AuditTeam`, `AuditTeamMember` (nuevos) + `AuditReport.auditTeamId` (FK nullable existente tras migración).

**AuditReport**: El campo `AuditReport.auditTeamId` se establece al vincular un equipo a un informe — operación fuera de scope de esta API (corresponde a `audit-report.service.ts`). Este contrato solo gestiona la constitución del equipo.

**Project**: `AuditTeam.projectId` → `Project.id`. La API valida que el `Project` pertenezca al tenant del admin antes de crear el equipo.

**Company / User**: No hay endpoints directos sobre estas entidades en este contrato. La relación `Auditor.userId` permite vincular un `User` existente al registrar un auditor interno.

**Frontend**: En Phase 1 no existe UI de gestión de equipos — las operaciones se realizan vía API directa o admin tool. La UI de `/admin/audit-reports` mostrará el `AuditTeam` vinculado a un report una vez implementada la migración de datos.

---

## Open Questions

1. **¿Cifrado de `certificationNumber`?** — El número de certificación profesional puede estar sujeto a regulación de datos en algunos mercados (GDPR art. 9 si se interpreta como dato de categoría especial). Pendiente criterio legal antes de implementar.

2. **¿Los auditores externos necesitan acceso de solo lectura a sus asignaciones?** — En Phase 1 no. Si en fases posteriores se requiere, se necesita un mecanismo de invitación por token (no un `User` completo). Registrar como ADR cuando se decida.

3. **¿Migración de datos históricos de AuditReport?** — Los `AuditReport` existentes tienen `leadAuditor: String`, `auditors: Json`, `technicalExperts: Json`. La migración a `Auditor` + `AuditTeamMember` es una operación separada. Este contrato no la cubre — pendiente skill `migration`.

4. **¿Un AuditTeam puede ser compartido entre varios AuditReport del mismo engagement?** — El modelo lo permite (`AuditReport[] reports` en `AuditTeam`). El invariant de inmutabilidad (#5) aplica cuando cualquiera de los reports asociados está `signed`.
