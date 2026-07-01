# Domain Model: Audit Team & Actor Assignment

> BAOS Component: Audit Runtime
> Phase: Phase 1 — Technological Foundation
> Date: 2026-06-30
> Status: Draft

---

## Conceptual Model

Una **auditoría ISO 19650** requiere un equipo humano gobernado antes de que pueda ejecutarse ningún paso del runtime. Este modelo formaliza quiénes son esas personas, qué credenciales las habilitan, y cómo se vinculan a auditorías concretas con un rol específico.

**Auditor** — Una persona (interna o externa a la empresa cliente) que puede participar en auditorías. Tiene identidad propia en el sistema: nombre, contacto, certificaciones y cualificaciones. Puede estar vinculado a un `User` del sistema (si usa la plataforma directamente) o existir solo como registro profesional externo.

**AuditTeam** — El equipo formalmente constituido para una auditoría concreta. Un equipo se crea una vez para un proyecto/engagement y es el contexto en el que los auditores reciben sus roles. El equipo persiste con independencia de las versiones del informe que produzca.

**AuditTeamMember** — La asignación de un Auditor a un AuditTeam con un rol determinado. Es la pieza central del modelo: un mismo auditor puede ser lead auditor en un equipo y experto técnico en otro. Registra cuándo se invitó, cuándo confirmó y cuándo (si ocurre) se retiró.

Los tres **roles posibles** en un equipo son:
- `lead_auditor` — Responsable del equipo. Exactamente uno por equipo. Firma el informe final.
- `support_auditor` — Auditor de apoyo. Uno o más por equipo.
- `technical_expert` — Experto técnico en una materia específica (BIM, legal, estructuras…). No es auditor certificado per se, pero aporta criterio técnico.

---

## Entities and Responsibilities

| Entity | What it represents | Key attributes |
|--------|-------------------|----------------|
| `Auditor` | Profesional que realiza auditorías; puede ser interno (User) o externo | name, email, certificationLevel, qualifications, isExternal, status |
| `AuditTeam` | Equipo constituido para una auditoría concreta | projectId, auditId, status, formedAt |
| `AuditTeamMember` | Asignación de un Auditor a un AuditTeam con un rol específico | role, status, assignedAt, confirmedAt, withdrawnAt |

---

## Entity Relationships

```
Company (1) ──────────────── (N) Auditor
Company (1) ──────────────── (N) AuditTeam

User (0..1) ──────────────── (0..1) Auditor   [auditor interno]

Project (1) ──────────────── (N) AuditTeam

AuditTeam (1) ──────────────── (N) AuditTeamMember
Auditor   (1) ──────────────── (N) AuditTeamMember

AuditReport (1) ──────────── (0..1) AuditTeam  [team que produjo el report]

AuditTeamMember.role ∈ { lead_auditor | support_auditor | technical_expert }
```

**Cardinalidad del rol lead_auditor**: invariant — exactamente un `AuditTeamMember` con `role = lead_auditor` por `AuditTeam` (se aplica a nivel de servicio, no de constraint de BD).

---

## Prisma Schema

```prisma
// ─────────────────────────────────────────────
// AUDIT TEAM DOMAIN — BAOS Audit Runtime
// ─────────────────────────────────────────────

/// Un profesional que puede participar en auditorías.
/// Puede estar vinculado a un User interno o ser un auditor externo.
model Auditor {
  id                  String    @id @default(cuid())
  companyId           String                            // multi-tenant isolation
  userId              String?   @unique                 // vinculación opcional a User interno
  name                String
  email               String
  phone               String?
  certificationBody   String?                           // ej. "AENOR", "Bureau Veritas"
  certificationNumber String?
  certificationLevel  String?                           // ej. "lead_auditor_iso19011"
  qualifications      String[]  @default([])            // especialidades técnicas
  isExternal          Boolean   @default(false)         // externo a la empresa cliente
  status              String    @default("active")      // active | suspended | retired
  notes               String?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  createdById         String                            // governance trail

  company     Company           @relation(fields: [companyId], references: [id], onDelete: Restrict)
  user        User?             @relation(fields: [userId], references: [id], onDelete: SetNull)
  assignments AuditTeamMember[]

  @@unique([companyId, email])
  @@index([companyId])
  @@index([userId])
}

/// Equipo constituido para una auditoría concreta.
/// Se forma una vez por engagement de auditoría; persiste a través de versiones del informe.
model AuditTeam {
  id        String    @id @default(cuid())
  companyId String                            // multi-tenant isolation
  projectId String                            // proyecto auditado
  auditId   String                            // identificador del engagement (mismo campo que AuditReport.auditId)
  name      String?                           // nombre descriptivo del equipo (opcional)
  status    String    @default("forming")     // forming | active | completed | disbanded
  formedAt  DateTime  @default(now())
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  createdById String                          // governance trail

  company  Company           @relation(fields: [companyId], references: [id], onDelete: Restrict)
  project  Project           @relation(fields: [projectId], references: [id], onDelete: Restrict)
  members  AuditTeamMember[]
  reports  AuditReport[]     // informes producidos por este equipo

  @@index([companyId])
  @@index([projectId])
  @@index([auditId])
}

/// Asignación de un Auditor a un AuditTeam con un rol específico.
/// Tabla de cruce many-to-many con atributos propios de la asignación.
model AuditTeamMember {
  id           String    @id @default(cuid())
  auditTeamId  String
  auditorId    String
  role         String                          // lead_auditor | support_auditor | technical_expert
  status       String    @default("invited")  // invited | confirmed | active | withdrawn | completed
  assignedAt   DateTime  @default(now())
  confirmedAt  DateTime?
  withdrawnAt  DateTime?
  withdrawnReason String?
  notes        String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  createdById  String                          // governance trail

  auditTeam AuditTeam @relation(fields: [auditTeamId], references: [id], onDelete: Cascade)
  auditor   Auditor   @relation(fields: [auditorId], references: [id], onDelete: Restrict)

  @@unique([auditTeamId, auditorId])           // un auditor = un rol por equipo
  @@index([auditTeamId])
  @@index([auditorId])
}
```

**Modificaciones a modelos existentes:**

```prisma
// AuditReport — añadir FK al equipo (sustituye los campos JSON actuales)
model AuditReport {
  // ... campos existentes ...
  auditTeamId String?                          // FK al equipo (nullable para compatibilidad)
  auditTeam   AuditTeam? @relation(fields: [auditTeamId], references: [id], onDelete: SetNull)
  // leadAuditor, auditors, technicalExperts (Json) quedan como legacy
  // hasta que se complete la migración de datos
}

// Company — añadir relaciones inversas
model Company {
  // ... campos existentes ...
  auditors   Auditor[]
  auditTeams AuditTeam[]
}

// Project — añadir relación inversa
model Project {
  // ... campos existentes ...
  auditTeams AuditTeam[]
}

// User — añadir relación inversa
model User {
  // ... campos existentes ...
  auditorProfile Auditor?
}
```

---

## BAOS Compliance Checklist

- [x] Todas las entidades top-level tienen `companyId` (multi-tenant isolation: `Auditor`, `AuditTeam`)
- [x] Todas las entidades tienen `createdAt` y `updatedAt` (audit trail)
- [x] Todas las entidades tienen `createdById` (governance — quién creó el registro)
- [x] Cascade delete rules definidas explícitamente en todas las relaciones
  - `Auditor → Company`: `Restrict` — no se elimina una empresa con auditores
  - `Auditor → User`: `SetNull` — si se elimina el User, el Auditor permanece como externo
  - `AuditTeamMember → AuditTeam`: `Cascade` — si se disuelve el equipo, se eliminan asignaciones
  - `AuditTeamMember → Auditor`: `Restrict` — no se elimina un auditor con asignaciones activas
  - `AuditTeam → AuditReport`: `SetNull` — si se elimina el equipo, el report no desaparece
- [ ] Evidence entities link to their source requirement/control — N/A para este componente de actores
- [x] No hay modificación sin versión: `AuditTeamMember.status` captura el lifecycle completo (invited → confirmed → withdrawn/completed) con timestamps explícitos. Para cambios de rol, se retira (`withdrawnAt`) y se crea una nueva asignación.
- [x] No hay decisiones autónomas: todo estado de asignación requiere acción humana explícita
- [ ] Campos sensibles documentados: `Auditor.certificationNumber` puede requerir cifrado dependiendo de la regulación de datos profesionales aplicable

---

## Invariants and Business Rules

1. **Un único lead auditor por equipo**: En cada `AuditTeam`, exactamente un `AuditTeamMember` puede tener `role = lead_auditor`. Validar en la capa de servicio antes de confirmar cualquier asignación.

2. **Un auditor, un rol por equipo**: `@@unique([auditTeamId, auditorId])` garantiza que un Auditor no puede tener dos asignaciones simultáneas en el mismo equipo. Para cambiar de rol, se retira la asignación existente y se crea una nueva.

3. **El lead auditor no puede ser retirado sin nombrarse un sucesor**: Si `AuditTeamMember.role = lead_auditor` pasa a `status = withdrawn`, debe existir ya (o crearse en la misma transacción) otro miembro con `role = lead_auditor` y `status = confirmed`.

4. **Un Auditor con asignaciones activas no puede ser eliminado ni suspendido**: `status != active` se puede propagar, pero el servicio debe verificar asignaciones en `status ∈ {invited, confirmed, active}` antes de suspender o retirar a un Auditor.

5. **El AuditTeam de un AuditReport firmado es inmutable**: Una vez que un `AuditReport` alcanza `status = signed` o `finalizado`, ninguna `AuditTeamMember` de su equipo puede ser modificada. Toda enmienda genera un nuevo report version con el team correspondiente.

6. **Auditor externo no requiere User**: `Auditor.userId` es nullable. Un auditor puede existir como registro profesional sin acceso a la plataforma.

7. **Unicidad de email por empresa**: `@@unique([companyId, email])` en `Auditor`. Un mismo email externo puede existir como Auditor en distintas empresas (tenants distintos).

---

## Integration with Existing Schema

**AuditReport** — Los campos actuales `leadAuditor: String`, `auditors: Json`, `technicalExperts: Json` son almacenamiento plano heredado. La integración consiste en añadir `auditTeamId` (nullable FK a `AuditTeam`) manteniendo los campos JSON como legacy durante la migración. Una vez migrados los datos históricos, los campos JSON pueden marcarse como deprecated. El campo `auditId: String` en `AuditReport` es el mismo identificador que `AuditTeam.auditId` — es el nexo de unión entre report y team.

**Project** — `AuditTeam.projectId` referencia `Project.id`. Un proyecto puede tener múltiples equipos si se realizan auditorías sucesivas. Añadir `auditTeams AuditTeam[]` a `Project`.

**Company** — Añadir `auditors Auditor[]` y `auditTeams AuditTeam[]` a `Company`. El tenant gestiona su propio roster de auditores.

**User** — `Auditor.userId` permite que un usuario de la plataforma tenga un perfil de auditor. Añadir `auditorProfile Auditor?` a `User` (relación 1-to-0..1).

**Migraciones requeridas en tablas existentes**:
- `AuditReport`: añadir columna `auditTeamId String?` + FK constraint
- `Company`: sin cambios de columna (solo relaciones inversas en Prisma)
- `Project`: sin cambios de columna (solo relaciones inversas en Prisma)
- `User`: sin cambios de columna (solo relación inversa en Prisma)

---

## Open Questions

1. **¿Los technical_experts necesitan certificación?** — En ISO 19011, los expertos técnicos no son auditores certificados. El modelo actual los admite sin `certificationLevel`. ¿Debe haber validación diferente por rol en la UI?

2. **¿Un AuditTeam puede ser reutilizado en varios proyectos?** — El modelo actual vincula `AuditTeam` a un único `projectId`. Si el negocio requiere equipos recurrentes para el mismo cliente, considerar desvincular el equipo del proyecto y vincularlo solo al `auditId` + `companyId`.

3. **¿Los auditores externos deben tener acceso de solo lectura a sus asignaciones?** — Si un auditor externo necesita ver el informe que firmó, requeriría un mecanismo de invitación separado (token de acceso temporal, no un `User` completo).

4. **Migración de datos históricos** — Los `AuditReport` existentes tienen `leadAuditor`, `auditors`, `technicalExperts` en JSON. ¿Se migran a `Auditor` + `AuditTeamMember` retroactivamente, o solo los nuevos registros usan el modelo normalizado?
