# Domain Model: Evidence Graph

> BAOS Component: Evidence Graph
> Phase: Phase 1 — Technological Foundation
> Date: 2026-06-30
> Status: Draft

---

## Conceptual Model

El **Evidence Graph** es el componente de BAOS responsable de registrar, validar y rastrear cada pieza de evidencia que fundamenta una conclusión de auditoría ISO 19650. Sin evidencia trazable no puede existir ningún resultado de auditoría (principio *evidence-first*).

Una **EvidenceItem** representa una pieza de evidencia concreta: puede ser un documento (plano BIM, procedimiento firmado), un registro (log de sistema, acta de reunión) o una declaración (testimonio escrito del responsable BIM). Cada EvidenceItem tiene un ciclo de vida de validación explícito — no puede influir en una conclusión de auditoría hasta haber sido validada por un auditor humano.

Una evidencia puede demostrar uno o varios requisitos ISO 19650 simultáneamente (por ejemplo, un BEP bien estructurado puede cubrir varios ítems de la norma). Esta relación se modela como **EvidenceRequirementLink**, que también registra el tipo de vínculo (soporte principal, soporte secundario, o evidencia contradictoria con el requisito).

Cuando se genera un informe de auditoría, las evidencias que sustentan sus conclusiones se registran explícitamente en **EvidenceReportLink**. Esto garantiza la trazabilidad completa: dado cualquier párrafo del informe, el sistema puede identificar qué evidencias lo respaldan, quién las validó y cuándo.

Cada modificación significativa de una EvidenceItem genera un snapshot en **EvidenceItemVersion**, siguiendo el mismo patrón de gobernanza que `AuditReport` / `AuditReportVersion`. El historial de decisiones de validación (quién aprobó, rechazó o solicitó aclaración) queda en **EvidenceValidation**, separado del ítem para mantener el registro inmutable.

---

## Entities and Responsibilities

| Entity | What it represents | Key attributes |
|--------|-------------------|----------------|
| `EvidenceItem` | Una pieza de evidencia (documento, registro o declaración) vinculada a un proyecto | type, status, sourceRef, title, description |
| `EvidenceRequirementLink` | Vínculo entre una evidencia y un requisito ISO 19650 | linkType (primary/supporting/contradictory) |
| `EvidenceReportLink` | Vínculo entre una evidencia y un informe de auditoría | usedAs (supporting/conclusion_basis/referenced) |
| `EvidenceValidation` | Registro de una decisión de validación humana sobre una evidencia | outcome, notes, validatedBy, validatedAt |
| `EvidenceItemVersion` | Snapshot inmutable del estado de una EvidenceItem en un momento dado | version, snapshot (JSON) |

---

## Entity Relationships

```
Project (1) ────────────────────── (N) EvidenceItem
                                         │
                   ┌─────────────────────┼──────────────────────────┐
                   │                     │                          │
                   ▼                     ▼                          ▼
    (N) EvidenceRequirementLink   (N) EvidenceValidation   (N) EvidenceItemVersion
                   │
                   ▼
          Requirement (N)


EvidenceItem (N) ─── EvidenceReportLink ─── (N) AuditReport


EvidenceItem (1) ◄── createdBy / updatedBy ── User
EvidenceRequirementLink (1) ◄── addedBy ── User
EvidenceReportLink (1) ◄── addedBy ── User
EvidenceValidation (1) ◄── validatedBy ── User
EvidenceItemVersion (1) ◄── createdBy ── User
```

Cardinalities:
- `Project` → `EvidenceItem`: 1-to-many (a project owns all its evidence)
- `EvidenceItem` ↔ `Requirement`: many-to-many via `EvidenceRequirementLink`
- `EvidenceItem` ↔ `AuditReport`: many-to-many via `EvidenceReportLink`
- `EvidenceItem` → `EvidenceValidation`: 1-to-many (one item, multiple validation decisions over time)
- `EvidenceItem` → `EvidenceItemVersion`: 1-to-many (one item, multiple version snapshots)

---

## Prisma Schema

```prisma
// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE GRAPH — Core entity
// ─────────────────────────────────────────────────────────────────────────────

model EvidenceItem {
  id          String   @id @default(cuid())
  projectId   String                          // tenant isolation via project → company
  title       String
  description String   @default("")
  type        String                          // "document" | "record" | "declaration"
  sourceRef   String?                         // URL, file path, or external reference ID
  status      String   @default("draft")     // "draft" | "submitted" | "under_review" | "validated" | "rejected" | "archived"
  version     Int      @default(1)           // incremented on each content change
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdBy   String                          // userId
  updatedBy   String?                         // userId — last modifier

  project          Project                   @relation(fields: [projectId], references: [id], onDelete: Restrict)
  creator          User                      @relation("EvidenceCreator", fields: [createdBy], references: [id], onDelete: Restrict)
  requirementLinks EvidenceRequirementLink[]
  reportLinks      EvidenceReportLink[]
  validations      EvidenceValidation[]
  versions         EvidenceItemVersion[]

  @@index([projectId])
  @@index([createdBy])
  @@index([status])
}

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE GRAPH — Many-to-many: EvidenceItem ↔ Requirement
// ─────────────────────────────────────────────────────────────────────────────

model EvidenceRequirementLink {
  id             String   @id @default(cuid())
  evidenceItemId String
  requirementId  String
  linkType       String   @default("supporting") // "primary" | "supporting" | "contradictory"
  addedAt        DateTime @default(now())
  addedBy        String                          // userId

  evidenceItem   EvidenceItem @relation(fields: [evidenceItemId], references: [id], onDelete: Cascade)
  requirement    Requirement  @relation(fields: [requirementId], references: [id], onDelete: Cascade)
  addedByUser    User         @relation("EvidenceLinkAdder", fields: [addedBy], references: [id], onDelete: Restrict)

  @@unique([evidenceItemId, requirementId])
  @@index([evidenceItemId])
  @@index([requirementId])
}

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE GRAPH — Many-to-many: EvidenceItem ↔ AuditReport (traceability)
// ─────────────────────────────────────────────────────────────────────────────

model EvidenceReportLink {
  id             String   @id @default(cuid())
  evidenceItemId String
  auditReportId  String
  usedAs         String   @default("supporting") // "supporting" | "conclusion_basis" | "referenced"
  addedAt        DateTime @default(now())
  addedBy        String                          // userId

  evidenceItem   EvidenceItem @relation(fields: [evidenceItemId], references: [id], onDelete: Cascade)
  auditReport    AuditReport  @relation(fields: [auditReportId], references: [id], onDelete: Cascade)
  addedByUser    User         @relation("ReportLinkAdder", fields: [addedBy], references: [id], onDelete: Restrict)

  @@unique([evidenceItemId, auditReportId])
  @@index([evidenceItemId])
  @@index([auditReportId])
}

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE GRAPH — Human-in-the-loop validation trail
// ─────────────────────────────────────────────────────────────────────────────

model EvidenceValidation {
  id             String   @id @default(cuid())
  evidenceItemId String
  outcome        String                          // "approved" | "rejected" | "pending_clarification"
  notes          String   @default("")
  validatedAt    DateTime @default(now())
  validatedBy    String                          // userId

  evidenceItem   EvidenceItem @relation(fields: [evidenceItemId], references: [id], onDelete: Cascade)
  validator      User         @relation("EvidenceValidator", fields: [validatedBy], references: [id], onDelete: Restrict)

  @@index([evidenceItemId])
  @@index([validatedBy])
}

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE GRAPH — Governance snapshot (follows AuditReport/AuditReportVersion pattern)
// ─────────────────────────────────────────────────────────────────────────────

model EvidenceItemVersion {
  id             String   @id @default(cuid())
  evidenceItemId String
  version        Int
  snapshot       Json                            // full EvidenceItem state at this version
  changeReason   String   @default("")          // why this version was created
  createdAt      DateTime @default(now())
  createdBy      String                          // userId

  evidenceItem   EvidenceItem @relation(fields: [evidenceItemId], references: [id], onDelete: Cascade)
  creator        User         @relation("EvidenceVersionCreator", fields: [createdBy], references: [id], onDelete: Restrict)

  @@unique([evidenceItemId, version])
  @@index([evidenceItemId])
}
```

### Back-relations required on existing models

The following fields must be added to the existing Prisma models:

```prisma
// In model Project — add:
evidenceItems    EvidenceItem[]

// In model Requirement — add:
evidenceLinks    EvidenceRequirementLink[]

// In model AuditReport — add:
evidenceLinks    EvidenceReportLink[]

// In model User — add (named relations required):
evidenceItemsCreated     EvidenceItem[]            @relation("EvidenceCreator")
evidenceLinksAdded       EvidenceRequirementLink[] @relation("EvidenceLinkAdder")
evidenceReportLinksAdded EvidenceReportLink[]      @relation("ReportLinkAdder")
evidenceValidations      EvidenceValidation[]      @relation("EvidenceValidator")
evidenceVersionsCreated  EvidenceItemVersion[]     @relation("EvidenceVersionCreator")
```

---

## BAOS Compliance Checklist

- [x] All top-level entities have tenant isolation — `EvidenceItem.projectId` → `Project.companyId ?? Project.userId` (same chain as `Requirement`; direct `companyId` not added to avoid diverging from schema convention, but ownership chain is always resolvable)
- [x] All entities have `createdAt` (and `updatedAt` where mutable)
- [x] All entities have `createdBy` or equivalent actor reference (`createdBy`, `addedBy`, `validatedBy`)
- [x] Cascade delete rules explicitly defined: `EvidenceRequirementLink`, `EvidenceReportLink`, `EvidenceValidation`, `EvidenceItemVersion` all `onDelete: Cascade`; `EvidenceItem` uses `onDelete: Restrict` (blocks project deletion if evidence exists — intentional)
- [x] Evidence entities link to their source requirement/control — `EvidenceRequirementLink` provides typed foreign key (not opaque JSON)
- [x] Mutable state creates version records — `EvidenceItemVersion` snapshots every content change, following the `AuditReport`/`AuditReportVersion` pattern
- [x] No autonomous decision fields — `EvidenceItem.status` transitions require explicit `EvidenceValidation` records authored by a human (`validatedBy` is mandatory, non-nullable)
- [ ] Sensitive fields documented for encryption — `EvidenceItem.sourceRef` and `snapshot` JSON in `EvidenceItemVersion` may contain paths to sensitive documents; encryption at rest required at the storage layer (not enforced in schema, flagged for Phase 2)

---

## Invariants and Business Rules

1. An `EvidenceItem` with `status = "validated"` must have at least one `EvidenceValidation` record with `outcome = "approved"`.

2. An `EvidenceItem` cannot be linked to an `AuditReport` (`EvidenceReportLink`) unless its `status` is `"validated"`. Linking un-validated evidence to a report conclusion violates the *evidence-first* principle.

3. An `EvidenceItem` cannot be deleted if it has any `EvidenceReportLink` records. Evidence cited in a finalized report is immutable (delete is blocked, only archival via `status = "archived"` is allowed).

4. `EvidenceItemVersion.version` numbers are monotonically increasing and never reused within a given `evidenceItemId`.

5. `EvidenceItem.version` must equal the highest `EvidenceItemVersion.version` for that item (enforced at the service layer, not the DB).

6. `EvidenceRequirementLink.linkType = "contradictory"` triggers a mandatory review: the item's status must be reset to `"under_review"` and the contradiction flagged to the Contradiction Engine.

7. An `EvidenceReportLink` cannot be added to a closed `AuditReport` — `status = "signed"` or `"finalizado"`. Closed reports are immutable. *(Corregido 2026-08-06: este punto decía `status = "final"`, valor inexistente en la implementación. Los estados reales de cierre son los que ya recoge `docs/domain-models/audit-team.md` y comprueba `audit-team.service.ts`.)*

8. Deleting a `Requirement` cascades to `EvidenceRequirementLink` but NOT to `EvidenceItem` itself. An evidence item linked to a deleted requirement is not automatically deleted; it becomes an orphan evidence that must be reviewed.

---

## Integration with Existing Schema

| Existing model | Integration point | Nature of change |
|----------------|------------------|-----------------|
| `Project` | `EvidenceItem.projectId → Project.id` | New back-relation `evidenceItems EvidenceItem[]` on `Project` |
| `Requirement` | `EvidenceRequirementLink.requirementId → Requirement.id` | New back-relation `evidenceLinks EvidenceRequirementLink[]` on `Requirement` |
| `AuditReport` | `EvidenceReportLink.auditReportId → AuditReport.id` | New back-relation `evidenceLinks EvidenceReportLink[]` on `AuditReport`; replaces the opaque `traceability Json` field over time |
| `User` | Five named relations for the five actor roles | Five new back-relation fields on `User` (named to avoid Prisma ambiguity) |

### Migration notes

- New tables: `EvidenceItem`, `EvidenceRequirementLink`, `EvidenceReportLink`, `EvidenceValidation`, `EvidenceItemVersion` — all additive, no existing table altered.
- Back-relation fields on `Project`, `Requirement`, `AuditReport`, and `User` are relation-only (no DB column created); they require only a Prisma schema update and `prisma generate`, not a migration.
- The `AuditReport.traceability Json` field currently stores evidence references as opaque JSON. The `EvidenceReportLink` table formalizes this. A data migration script will be needed (Phase 2) to backfill existing `traceability` JSON into proper `EvidenceReportLink` rows.

---

## Open Questions

1. **File storage**: `EvidenceItem.sourceRef` stores a reference string. Where are actual document files stored — Vercel Blob, S3, or external DMS? The answer determines whether `sourceRef` is a URL, an object key, or an opaque external ID, and what encryption/access-control model applies.

2. **Cross-project evidence reuse**: Can a single evidence document (e.g., a company-wide BEP) be reused across multiple projects, or is evidence always scoped to one project? If reuse is needed, `EvidenceItem` must be promoted to company scope with a different tenant isolation strategy.

3. **Contradiction Engine integration**: When `linkType = "contradictory"` is set on an `EvidenceRequirementLink`, how does the Contradiction Engine receive the notification — synchronous event, queue message, or polling? This affects whether we need a `ContradictionTrigger` join table or a simple status flag on `EvidenceRequirementLink`.

4. **`evidencia` field on `Requirement`**: The existing `Requirement.evidencia String?` field stores a free-text evidence description. Once `EvidenceItem` is live, this field becomes redundant. Decision needed: deprecate and migrate, or keep as a human-readable summary alongside the structured evidence graph?
