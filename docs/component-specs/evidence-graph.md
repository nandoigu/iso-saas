# Component Spec: Evidence Graph

> BAOS Component: Evidence Graph
> Module: —
> Phase: Phase 1 — Technological Foundation
> Date: 2026-07-01
> Status: Draft

---

## Strategic Purpose

El Evidence Graph garantiza que toda conclusión de una auditoría ISO 19650 sea trazable hasta una pieza concreta de evidencia validada por un humano, permitiendo que cualquier revisor autorizado reconstruya, párrafo a párrafo, en qué se sustenta un informe. Materializa el principio *evidence-first* de BAOS: sin evidencia trazable no existe resultado de auditoría.

---

## Architectural Position

| Attribute | Value |
|-----------|-------|
| BAOS layer | Knowledge |
| Implementation phase | Phase 1 Foundation |
| Entry point | `app/api/projects/[projectId]/evidence`, `app/api/evidence/[evidenceId]/*` (user+admin), `app/api/admin/evidence/[evidenceId]/*` (admin only — validar, vincular a informe, archivo), `services/evidence.service.ts` |
| Persistence | Prisma models: `EvidenceItem`, `EvidenceRequirementLink`, `EvidenceReportLink`, `EvidenceValidation`, `EvidenceItemVersion` |
| Boundary | Posee el ciclo de vida y validación de evidencias, y sus vínculos tipados con `Requirement` y `AuditReport`. NO posee la generación del contenido del informe ni la evaluación normativa de los requisitos. |

---

## Dependency Map

### Upstream (what this component consumes)

| Dependency | Type | What it provides |
|-----------|------|-----------------|
| `Project` model | Prisma | Ámbito de tenant (aislamiento vía cadena `Project → Company/User`) |
| `Requirement` model | Prisma | Requisito ISO 19650 al que una evidencia da soporte o contradice |
| `AuditReport` model | Prisma | Informe al que una evidencia validada queda vinculada como base de conclusión |
| `User` / `app/lib/auth.ts` | Internal | Identidad del actor para `createdBy`, `addedBy`, `validatedBy` y RBAC |

### Downstream (what depends on this component)

| Dependent | Type | What it needs from here |
|----------|------|------------------------|
| Audit Runtime (futuro) | Service call | Evidencias validadas como precondición para avanzar el estado de una auditoría |
| `AuditReport` / `audit-report.generator.ts` | Service call | `EvidenceReportLink` para reemplazar el campo opaco `traceability Json` (Phase 2) |
| Contradiction Engine (futuro) | Event/trigger | Notificación cuando `EvidenceRequirementLink.linkType = "contradictory"` |
| `/admin/audit-reports` (UI, futuro) | Internal API | Listado de evidencias por proyecto/requisito para adjuntar a un informe |

### External dependencies

| Dependency | Purpose | Risk if unavailable |
|-----------|---------|-------------------|
| Neon PostgreSQL | Persistencia de EvidenceItem y su historial de versiones/validaciones | Full outage |
| Almacenamiento de archivos (a definir — ver Open Questions) | Fuente real del documento referenciado por `sourceRef` | Evidencia queda sin archivo fuente accesible, pero el registro y su validación siguen íntegros |

---

## Functional Scope

### This component IS responsible for

- Registrar piezas de evidencia (`EvidenceItem`) de tipo documento, registro o declaración, asociadas a un proyecto.
- Gestionar el ciclo de vida de validación humana de cada evidencia (`draft → submitted → under_review → validated/rejected → archived`).
- Vincular evidencias con uno o varios requisitos ISO 19650, tipando la naturaleza del vínculo (soporte principal, secundario, contradictorio).
- Vincular evidencias validadas con las conclusiones de un informe de auditoría, dejando trazabilidad explícita (`EvidenceReportLink`).
- Versionar cada cambio significativo de una evidencia (`EvidenceItemVersion`), siguiendo el patrón de gobernanza ya usado en `AuditReport`/`AuditReportVersion`.
- Bloquear operaciones que violen el principio evidence-first: evidencia no validada no puede sustentar conclusiones; evidencia citada en un informe final no puede eliminarse.

### This component is NOT responsible for

- Generar el contenido o redacción del informe de auditoría — eso es responsabilidad de `audit-report.generator.ts`.
- Evaluar si un requisito normativo se cumple o no — eso es responsabilidad del futuro Rule Engine.
- Detectar o resolver contradicciones entre evidencias — eso es responsabilidad del futuro Contradiction Engine; el Evidence Graph solo marca el vínculo como `contradictory` y dispara la notificación.
- Almacenar el archivo binario de la evidencia — `sourceRef` es una referencia; el almacenamiento real vive en la capa de storage que se decida (ver Open Questions).
- Tomar decisiones de validación de forma autónoma — toda transición a `validated`/`rejected` requiere un `EvidenceValidation` con `validatedBy` humano no nulo.

---

## Non-Functional Requirements

| Requirement | Target | Notes |
|------------|--------|-------|
| Multi-tenant isolation | Mandatory | `EvidenceItem.projectId` resuelve el tenant vía la misma cadena que `Requirement` |
| Audit trail | Mandatory | `createdAt`/`updatedAt` en `EvidenceItem`; actor obligatorio en las 5 entidades (`createdBy`/`addedBy`/`validatedBy`) |
| Human-in-the-loop | Mandatory | `EvidenceValidation.validatedBy` no nulo; sin transición autónoma de `status` |
| Evidence traceability | Mandatory | Es el propio componente que provee trazabilidad al resto de BAOS |
| Response time (p95) | < 2s | Endpoints síncronos de listado/creación/validación |
| Data retention | Indefinida | Evidencia citada en informe final es inmutable (solo archivable, no eliminable) |
| Encryption at rest | Vía Neon | `sourceRef` y `EvidenceItemVersion.snapshot` marcados como sensibles — pendiente decisión de cifrado adicional en security-spec |

---

## Implementation Checklist

- [x] Domain model documentado (`docs/domain-models/evidence-graph.md`)
- [x] ADR de decisiones técnicas (`docs/adr/ADR-003-evidence-graph-phase1-scoping.md`)
- [x] API contract definido (`docs/api-contracts/evidence-graph.md`)
- [ ] Migración Prisma escrita y aplicada
- [ ] Capa de servicio implementada (`services/evidence.service.ts`)
- [ ] Route handlers implementados (`app/api/admin/evidence/*`)
- [ ] Checklist de compliance BAOS pasado (tenant scope, audit trail, RBAC)
- [x] Security spec definido (`docs/security-specs/evidence-graph.md`)
- [x] Test plan definido (`docs/test-plans/evidence-graph.md`)
- [ ] Smoke test añadido a `scripts/smoke.ts`
- [ ] Handoff actualizado en `docs/handoff.md`

---

## Open Questions

Resueltas en `docs/adr/ADR-003-evidence-graph-phase1-scoping.md`:

1. **Almacenamiento de archivos** — Vercel Blob, store privado. `sourceRef` guarda el `pathname`; el acceso se sirve vía signed URL de corta duración a través de una ruta interna que verifica pertenencia al proyecto.
2. **Reutilización de evidencia entre proyectos** — NO en Phase 1. `EvidenceItem` permanece acotado a `projectId`, igual que `Requirement`. Promoción a scope `Company` diferida a Phase 2 si se confirma la necesidad.
3. **Integración con Contradiction Engine** — Solo flag de estado (`linkType = "contradictory"` + `status = "under_review"`), sin tabla de trigger ni cola. El futuro Contradiction Engine puede consultar directamente ese estado.
4. **Campo `Requirement.evidencia` legado** — Se mantiene sin cambios en Phase 1 (uso activo en 21 archivos de producción). Backfill hacia `EvidenceRequirementLink` diferido a Phase 2.
