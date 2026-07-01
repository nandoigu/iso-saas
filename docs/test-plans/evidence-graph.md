# Test Plan: Evidence Graph

> BAOS Component: Evidence Graph
> Component Spec: docs/component-specs/evidence-graph.md
> API Contract: docs/api-contracts/evidence-graph.md
> Domain Model: docs/domain-models/evidence-graph.md
> Security Spec: docs/security-specs/evidence-graph.md
> Date: 2026-07-01
> Status: Draft

---

## Estado actual de la infraestructura de tests

A diferencia de Audit Team (cuyo test-plan original se escribió antes de decidir el framework), este componente se implementa con la infraestructura **ya instalada y verificada** en la sesión anterior:

- **Vitest 4.x** + `@vitest/coverage-v8` + `dotenv`
- **DB de test**: Neon branch `test` (`ep-quiet-flower-ababf5t9`), aislado de producción
- **Helpers existentes**: `tests/helpers/db.ts` (factories: `createTenant`, `createProject`, `createAuditor`, ...) y `tests/helpers/auth.ts` (`sessionCookie`, `makeRequest`)
- **Scripts**: `npm test` / `npm run test:watch` / `npm run test:coverage`
- **Estructura**: `tests/services/*.test.ts` (lógica pura del servicio) + `tests/api/*.test.ts` (route handlers con Prisma real)

Este componente añade fixtures nuevas a `tests/helpers/db.ts` (`createEvidenceItem`, `createRequirementLink`, `createAuditReportFixture` si no existe ya) y dos archivos de test: `tests/services/evidence.service.test.ts` + `tests/api/evidence.test.ts`.

---

## Test Scope

### En scope

- Los 10 endpoints de `docs/api-contracts/evidence-graph.md` (`/api/projects/[projectId]/evidence`, `/api/evidence/[evidenceId]/*`, `/api/admin/evidence/[evidenceId]/*`)
- Las 8 invariants de negocio del domain model + la regla de inmutabilidad de `PATCH` sobre evidencia `validated`/`archived` (api-contract)
- RBAC mixto: dueño de proyecto vs. `admin` (distinto del "todo admin" de Audit Team — ver security-spec)
- Aislamiento de tenant vía `project.userId` (no `companyId` — ADR-003 decisión #2)
- Versionado (`EvidenceItemVersion`) en cada `PATCH` de contenido
- El flujo de signed URL de `GET .../file`, con Vercel Blob **mockeado** (no se llama al servicio real en tests)

### Fuera de scope

- Subida real del binario a Vercel Blob — cubierto por prueba manual/smoke, no por integración (evita dependencia de red y credenciales reales en CI)
- Tests del schema de Prisma — cubiertos por la skill `migration` al aplicar
- Contradiction Engine — no existe todavía; solo se testea el side effect de estado (`status → under_review`), no una integración real
- UI — no existe página de Evidence Graph en Phase 1

---

## Test Levels

| Nivel | Aplicable | Justificación |
|-------|----------|--------------|
| Unitario | Sí | Las invariants de `evidence.service.ts` son lógica pura sobre Prisma — testeables junto a las llamadas reales (mismo patrón que `audit-team.service.test.ts`) |
| Integración | Sí | Route handlers + Prisma + Neon test branch — la verificación más valiosa para tenant scope y RBAC |
| Smoke | Sí | Disponibilidad de endpoints en producción — añadir a `scripts/smoke-routes.mjs` |
| Manual | Sí | Flujo completo de upload de archivo a Blob — no automatizado en Phase 1 |

---

## Critical Test Cases

### AUTH — Autenticación y autorización

| ID | Caso | Resultado esperado |
|----|------|--------------------|
| AUTH-01 | Request sin cookie de sesión a cualquier endpoint | 401 |
| AUTH-02 | `role: user` (dueño del proyecto) en endpoints de lectura/CRUD de evidencia | 200/201 — permitido |
| AUTH-03 | `role: user` en `POST .../requirement-links` | 403 |
| AUTH-04 | `role: user` en `POST .../validate` | 403 |
| AUTH-05 | `role: user` en `POST .../report-links` | 403 |
| AUTH-06 | `role: admin` en cualquier endpoint | 200/201 según operación |
| AUTH-07 | Cookie de sesión expirada | 401 |

### TENANT — Aislamiento de tenant (obligatorio BAOS)

| ID | Caso | Resultado esperado |
|----|------|--------------------|
| TENANT-01 | `GET /api/evidence/[id]` con evidencia de un proyecto de otro usuario | 404 (no 403) |
| TENANT-02 | `GET /api/projects/[projectId]/evidence` con `projectId` de otro usuario | 404 |
| TENANT-03 | `GET /api/projects/[projectId]/evidence` devuelve solo evidencia del proyecto solicitado | Sin fuga de otros proyectos |
| TENANT-04 | `POST .../requirement-links` con `requirementId` de un proyecto distinto al de la evidencia | 404 |
| TENANT-05 | `POST .../report-links` (admin) con `auditReportId` de otro tenant | 404 |
| TENANT-06 | `PATCH /api/evidence/[id]` de otro usuario (no dueño, no admin) | 404 |
| TENANT-07 | `admin` puede acceder a evidencia de cualquier proyecto | 200 |

### HP — Happy path

| ID | Caso | Resultado esperado |
|----|------|--------------------|
| HP-01 | `POST /api/projects/[id]/evidence` con `title` y `type` válidos | 201 + `status: draft` |
| HP-02 | `GET /api/projects/[id]/evidence` | 200 + array de evidencia del proyecto |
| HP-03 | `GET /api/evidence/[id]` | 200 + detalle con `requirementLinks`, `reportLinks`, `validations` vacíos inicialmente |
| HP-04 | `PATCH /api/evidence/[id]` en `status: draft` actualiza `title`/`description` | 200 + campos actualizados + `version: 2` |
| HP-05 | `DELETE /api/evidence/[id]` sin `reportLinks` | 200 + `deleted: true` |
| HP-06 | `POST .../requirement-links` (admin) con `linkType: supporting` | 201 |
| HP-07 | `DELETE .../requirement-links/[linkId]` (admin) | 200 |
| HP-08 | `POST .../validate` (admin) con `outcome: approved` | 201 + evidencia pasa a `status: validated` |
| HP-09 | `POST .../report-links` (admin) sobre evidencia `validated` y report no `final` | 201 |
| HP-10 | `GET .../file` (dueño o admin) con `sourceRef` presente | 200 + `url` + `expiresAt` |

### VAL — Validación de entrada

| ID | Caso | Resultado esperado |
|----|------|--------------------|
| VAL-01 | `POST .../evidence` sin `title` | 400 |
| VAL-02 | `POST .../evidence` con `type` inválido (no `document/record/declaration`) | 400 |
| VAL-03 | `POST .../evidence` con `projectId` en body ignorado, usa el de la ruta | `projectId` de la ruta prevalece |
| VAL-04 | `POST .../requirement-links` sin `requirementId` | 400 |
| VAL-05 | `POST .../requirement-links` con `linkType` inválido | 400 |
| VAL-06 | `POST .../validate` sin `outcome` | 400 |
| VAL-07 | `POST .../validate` con `outcome` inválido | 400 |
| VAL-08 | `POST .../report-links` sin `auditReportId` | 400 |
| VAL-09 | `PATCH .../evidence/[id]` sin campos (body vacío) | 200 no-op, o 400 según implementación — decidir en implementación |

### INV — Invariants de negocio (críticos BAOS)

| ID | Caso | Resultado esperado | Invariant |
|----|------|--------------------|-----------|
| INV-01 | `POST .../validate` con `outcome: approved` | `EvidenceItem.status → validated` y se crea `EvidenceValidation` | #1 |
| INV-02 | `POST .../report-links` sobre evidencia `status: draft` (no validada) | 409 | #2 |
| INV-03 | `DELETE /api/evidence/[id]` con al menos un `EvidenceReportLink` | 409 | #3 |
| INV-04 | Dos `PATCH` consecutivos sobre la misma evidencia crean versiones `2` y `3` sin colisión | `EvidenceItemVersion.version` estrictamente creciente | #4 |
| INV-05 | Tras un `PATCH`, `EvidenceItem.version` coincide con el `version` más alto en `EvidenceItemVersion` | Igual | #5 |
| INV-06 | `POST .../requirement-links` con `linkType: contradictory` | `EvidenceItem.status → under_review` | #6 |
| INV-07 | `POST .../report-links` sobre `AuditReport.status: final` | 409 | #7 |
| INV-08 | Eliminar un `Requirement` que tiene `EvidenceRequirementLink` asociado | El link se elimina en cascada; el `EvidenceItem` NO se elimina (queda huérfano, revisable) | #8 |
| INV-09 | `PATCH /api/evidence/[id]` cuando `status ∈ {validated, archived}` | 409 | api-contract, regla de inmutabilidad |
| INV-10 | `POST .../validate` con `outcome: rejected` sobre evidencia `status: submitted` | `status → rejected`, evidencia vuelve a ser editable | Domain model — flujo de rechazo |

### TRAIL — Audit trail y versionado

| ID | Caso | Resultado esperado |
|----|------|--------------------|
| TRAIL-01 | Evidencia creada tiene `createdBy` = ID del usuario de la sesión | Campo poblado |
| TRAIL-02 | `PATCH` puebla `updatedBy` = ID del usuario que edita | Campo poblado |
| TRAIL-03 | `EvidenceValidation.validatedBy` = ID del admin que valida | Nunca aceptado del body — TENANT/AUTH test cruzado |
| TRAIL-04 | `EvidenceRequirementLink.addedBy` / `EvidenceReportLink.addedBy` = ID del admin que crea el vínculo | Campo poblado |
| VER-01 | `PATCH` con cambio de `title` crea un snapshot en `EvidenceItemVersion` | Count `EvidenceItemVersion` +1 |
| VER-02 | El `snapshot` de la versión contiene el estado previo completo (no el nuevo) | Snapshot coincide con estado pre-PATCH |

### FILE — Acceso a archivo (Vercel Blob mockeado)

| ID | Caso | Resultado esperado |
|----|------|--------------------|
| FILE-01 | `GET .../file` con `sourceRef` vacío | 404 |
| FILE-02 | `GET .../file` con `sourceRef` presente, mock de `@vercel/blob` devuelve URL | 200 + `url`/`expiresAt` — el mock verifica que se llama con el `pathname` correcto, no con una URL pública |
| FILE-03 | `GET .../file` de otro tenant | 404 antes de siquiera llamar al mock de Blob (verifica orden: tenant check primero) |

---

## Coverage Requirements

| Tipo de camino | Cobertura requerida |
|----------------|---------------------|
| Guards de auth/tenant | 100% |
| Invariants de negocio (#1–#8 + inmutabilidad) | 100% |
| Happy path (todas las operaciones CRUD + acciones admin) | 100% |
| Errores de validación documentados | Todos los campos del api-contract |
| Formas de respuesta de error | Spot check — sin detalles de Prisma ni de Blob |

---

## Test Data Strategy

### Setup de tenant (reutiliza `tests/helpers/db.ts`)

```typescript
const { company: companyA, admin: adminA, user: userA } = await createTenant("evidence-a");
const projectA = await createProject(companyA.id, userA.id);

const { company: companyB, admin: adminB, user: userB } = await createTenant("evidence-b");
const projectB = await createProject(companyB.id, userB.id);
```

### Fixtures nuevas a añadir en `tests/helpers/db.ts`

| Fixture | Propósito |
|---------|---------|
| `createEvidenceItem(projectId, createdById, overrides?)` | Crea un `EvidenceItem` en `status: draft` por defecto |
| `createRequirementLink(evidenceItemId, requirementId, addedById, linkType?)` | Crea un `EvidenceRequirementLink` |
| `createEvidenceValidation(evidenceItemId, validatedById, outcome)` | Crea un `EvidenceValidation` y aplica la transición de estado correspondiente |
| `createReportLink(evidenceItemId, auditReportId, addedById, usedAs?)` | Crea un `EvidenceReportLink` — requiere que la evidencia ya esté `validated` |

### Mock de Vercel Blob

```typescript
// tests/setup.ts o al inicio de tests/api/evidence.test.ts
vi.mock("@vercel/blob", () => ({
  head: vi.fn().mockResolvedValue({ url: "https://blob.test/mock-signed-url" }),
}));
```

No se ejercita el store real de Vercel Blob en tests de integración — evita dependencia de red/credenciales en CI. El flujo de subida real se verifica manualmente (ver checklist abajo).

---

## Smoke Tests

Añadir a `scripts/smoke-routes.mjs`:

```javascript
{ path: "/api/projects/test-project-id/evidence", expectedStatus: 401, name: "evidence list without session" },
{ path: "/api/evidence/nonexistent-id", expectedStatus: 401, name: "evidence detail without session" },
```

Ambos son stateless (sin sesión) y seguros contra producción.

---

## BAOS Compliance Test Obligations

- [ ] Aislamiento de tenant verificado (TENANT-01 a TENANT-07)
- [ ] Sin fuga de datos cross-tenant en `GET /api/projects/[id]/evidence`
- [ ] Invariants de negocio verificadas a nivel de API (INV-01 a INV-10)
- [ ] Audit trail (`createdBy`, `updatedBy`, `validatedBy`, `addedBy`) verificado (TRAIL-01 a TRAIL-04)
- [ ] Versionado verificado (VER-01, VER-02)
- [ ] Aprobación humana requerida para `status: validated` — sin bypass posible vía API (INV-01, INV-09)
- [ ] Acceso a archivo fuente nunca expone URL pública directa (FILE-02)
- [ ] Smoke checks añadidos a `scripts/smoke-routes.mjs`

---

## Verificación manual antes de deploy (checklist)

Pasos que no se automatizan en Phase 1 — requieren el store real de Vercel Blob:

- [ ] Subir un archivo real vía el flujo de client upload de Vercel Blob y confirmar que `sourceRef` se persiste correctamente
- [ ] `GET .../file` — confirmar que la signed URL descarga el archivo correcto y expira tras el tiempo documentado
- [ ] Confirmar que el store de Blob está en modo privado (no accesible sin signed URL)
- [ ] Flujo completo: crear evidencia → admin valida (`approved`) → admin la vincula a un `AuditReport` en `draft` → confirmar que aparece en `EvidenceReportLink`

---

## Open Questions

1. **¿`PATCH` con body vacío responde 200 no-op o 400?** — Ver VAL-09. Se decide en implementación; no bloquea el resto del plan.
2. **¿Se necesita una fixture `createAuditReportFixture` nueva o se reutiliza la de Audit Team?** — Revisar `tests/helpers/db.ts` al implementar; si ya existe un helper de `AuditReport` de otra suite, reutilizarlo en vez de duplicar.
