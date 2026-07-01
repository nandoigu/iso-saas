# Test Plan: Audit Team

> BAOS Component: Audit Runtime
> API Contract: docs/api-contracts/audit-team.md
> Domain Model: docs/domain-models/audit-team.md
> Security Spec: docs/security-specs/audit-team.md
> Date: 2026-07-01
> Status: Draft

---

## Estado actual de la infraestructura de tests

El proyecto **no tiene framework de tests unitarios ni de integración** instalado (sin Jest, sin Vitest). La única cobertura automatizada actual es `scripts/smoke-routes.mjs`, que verifica HTTP status codes contra la aplicación desplegada en producción.

Este plan define tres niveles de trabajo:

1. **Smoke tests** — ejecutables hoy con la infraestructura existente
2. **Tests de integración** — requieren instalar Jest + base de datos de test (decisión pendiente)
3. **Casos de prueba manual** — verificación funcional antes de cada deploy, documentada aquí para que sean reproducibles

---

## Test Scope

### En scope

- Los 6 endpoints bajo `/api/admin/auditors` y `/api/admin/audit-teams`
- Las 4 invariants de negocio del domain model (lead_auditor único, sucesor requerido, auditor activo no suspendible, equipo de report firmado inmutable)
- Aislamiento de tenant (companyId siempre de sesión, nunca del cliente)
- Control de acceso (solo admin, 401 sin sesión, 403 sin rol)

### Fuera de scope

- Tests del schema de Prisma — la migración `20260701143914_add_audit_team` ya fue aplicada y validada
- Tests de la lógica de exportación PDF/DOCX — pertenece al test plan de `AuditReport`
- Tests de UI — no existe página de gestión de equipos en Phase 1
- Cifrado de `certificationNumber` — decisión tomada: cifrado en reposo de Neon, sin lógica de aplicación que testear

---

## Test Levels

| Nivel | Aplicable | Justificación |
|-------|----------|--------------|
| Unitario | Sí (futuro) | La lógica de invariants en `audit-team.service.ts` es pura y testeable en aislamiento. Requiere Jest. |
| Integración | Sí (futuro) | Los route handlers con Prisma + BD real son la verificación más valiosa. Requiere Jest + DB de test. |
| Smoke | Sí (hoy) | Verificación de disponibilidad de endpoints en producción — añadir a `scripts/smoke-routes.mjs`. |
| Manual | Sí (hoy) | Verificación funcional de invariants antes de deploy — documentada en sección de casos manuales. |

---

## Casos de prueba — Smoke (ejecutables hoy)

Añadir a `scripts/smoke-routes.mjs`:

| ID | Check | Endpoint | Expected |
|----|-------|----------|---------|
| SMOKE-01 | GET auditors sin sesión devuelve 401 | `GET /api/admin/auditors` | 401 |
| SMOKE-02 | GET audit-teams sin sesión devuelve 401 | `GET /api/admin/audit-teams` | 401 |
| SMOKE-03 | GET members sin sesión devuelve 401 | `GET /api/admin/audit-teams/nonexistent/members` | 401 |

Estos tres son stateless (sin sesión) y por tanto seguros para correr contra producción sin efectos secundarios.

---

## Casos de prueba — Integración (requieren Jest)

### AUTH — Autenticación y autorización

| ID | Caso | Resultado esperado |
|----|------|--------------------|
| AUTH-01 | Request sin cookie `bmo_session` a cualquier endpoint | 401 |
| AUTH-02 | Request con sesión válida de usuario `role: user` a cualquier endpoint de este componente | 403 |
| AUTH-03 | Request con sesión de admin válida | 200 / 201 según operación |
| AUTH-04 | Request con cookie expirada | 401 |

### TENANT — Aislamiento de tenant (obligatorio BAOS)

| ID | Caso | Resultado esperado |
|----|------|--------------------|
| TENANT-01 | `GET /api/admin/auditors/[id]` con ID de auditor de otro tenant | 404 (no 403) |
| TENANT-02 | `GET /api/admin/auditors` devuelve solo auditores del tenant del admin | Solo registros del companyId de la sesión |
| TENANT-03 | `POST /api/admin/auditors` con `companyId` en el body | `companyId` ignorado — usa el de la sesión |
| TENANT-04 | `GET /api/admin/audit-teams/[id]` con ID de equipo de otro tenant | 404 |
| TENANT-05 | `POST /api/admin/audit-teams/[teamId]/members` con `auditorId` de otro tenant | 404 (auditor no encontrado) |
| TENANT-06 | `GET /api/admin/audit-teams` devuelve solo equipos del tenant del admin | Solo registros del companyId de la sesión |

### HP — Happy path

| ID | Caso | Resultado esperado |
|----|------|--------------------|
| HP-01 | `POST /api/admin/auditors` con datos válidos | 201 + auditor creado con `companyId` de sesión |
| HP-02 | `GET /api/admin/auditors` | 200 + array (vacío o con registros del tenant) |
| HP-03 | `GET /api/admin/auditors/[id]` con ID válido del tenant | 200 + detalle con `assignments[]` |
| HP-04 | `PATCH /api/admin/auditors/[id]` actualiza `phone` y `certificationLevel` | 200 + campos actualizados |
| HP-05 | `POST /api/admin/audit-teams` con `projectId` y `auditId` válidos | 201 + equipo con `status: forming` |
| HP-06 | `GET /api/admin/audit-teams` | 200 + array con `memberCount` y `leadAuditor` |
| HP-07 | `GET /api/admin/audit-teams/[id]` | 200 + detalle con `members[]` |
| HP-08 | `PATCH /api/admin/audit-teams/[id]` actualiza `name` y `status: active` | 200 + campos actualizados |
| HP-09 | `POST /api/admin/audit-teams/[teamId]/members` asigna `support_auditor` | 201 + miembro con `status: invited` |
| HP-10 | `PATCH /api/admin/audit-teams/[teamId]/members/[id]` cambia a `status: confirmed` | 200 + `confirmedAt` poblado |
| HP-11 | `PATCH /api/admin/audit-teams/[teamId]/members/[id]` cambia a `status: withdrawn` (no lead) | 200 + `withdrawnAt` poblado |

### VAL — Validación de entrada

| ID | Caso | Resultado esperado |
|----|------|--------------------|
| VAL-01 | `POST /api/admin/auditors` sin `name` | 400 |
| VAL-02 | `POST /api/admin/auditors` con `email` inválido | 400 |
| VAL-03 | `POST /api/admin/auditors` con `email` duplicado en el tenant | 409 |
| VAL-04 | `POST /api/admin/auditors` con `userId` que ya tiene perfil de auditor | 409 |
| VAL-05 | `POST /api/admin/audit-teams` sin `projectId` | 400 |
| VAL-06 | `POST /api/admin/audit-teams` sin `auditId` | 400 |
| VAL-07 | `POST /api/admin/audit-teams` con `projectId` de otro tenant | 404 |
| VAL-08 | `PATCH /api/admin/auditors/[id]` con `status` inválido | 400 |
| VAL-09 | `PATCH /api/admin/audit-teams/[id]` con `status` inválido | 400 |
| VAL-10 | `POST /api/admin/audit-teams/[teamId]/members` sin `auditorId` | 400 |
| VAL-11 | `POST /api/admin/audit-teams/[teamId]/members` con `role` inválido | 400 |
| VAL-12 | `POST /api/admin/audit-teams/[teamId]/members` con auditor `status: suspended` | 404 |
| VAL-13 | `PATCH /api/admin/audit-teams/[teamId]/members/[id]` con `status` inválido | 400 |

### INV — Invariants de negocio (críticos BAOS)

| ID | Caso | Resultado esperado | Invariant |
|----|------|--------------------|-----------|
| INV-01 | Asignar segundo `lead_auditor` cuando ya existe uno activo en el equipo | 409 — "Ya existe un auditor líder activo" | Invariant #1 |
| INV-02 | Asignar `lead_auditor` cuando el único existente está `withdrawn` | 201 — se permite (el anterior está retirado) | Invariant #1 |
| INV-03 | Asignar el mismo auditor dos veces al mismo equipo | 409 — "Este auditor ya está asignado" | Invariant #2 |
| INV-04 | Retirar `lead_auditor` sin que exista otro `lead_auditor` en estado `confirmed` o `active` | 409 — "No se puede retirar al auditor líder sin nombrar un sucesor confirmado" | Invariant #3 |
| INV-05 | Retirar `lead_auditor` cuando ya existe otro `lead_auditor` confirmado | 200 — retirada permitida | Invariant #3 |
| INV-06 | `PATCH auditor status: suspended` con asignaciones en estado `invited` | 403 — "No se puede suspender o retirar un auditor con asignaciones activas" | Invariant #4 |
| INV-07 | `PATCH auditor status: retired` con asignaciones en estado `active` | 403 — ídem | Invariant #4 |
| INV-08 | `PATCH auditor status: suspended` cuando todas sus asignaciones están `withdrawn` o `completed` | 200 — permitido | Invariant #4 |
| INV-09 | `PATCH miembro` en equipo vinculado a `AuditReport` con `status: signed` | 409 — "El equipo está vinculado a un informe firmado y no puede modificarse" | Invariant #5 |
| INV-10 | `PATCH equipo status: disbanded` cuando tiene `AuditReport` con `status: signed` | 403 — "No se puede disolver un equipo vinculado a un informe firmado" | Invariant #5 |
| INV-11 | `PATCH equipo status: disbanded` cuando sus reports están todos en `draft` | 200 — permitido | Invariant #5 |

### TRAIL — Audit trail

| ID | Caso | Resultado esperado |
|----|------|--------------------|
| TRAIL-01 | Auditor creado tiene `createdById` = ID del admin que hizo la request | Campo poblado con userId de sesión |
| TRAIL-02 | AuditTeam creado tiene `createdById` = ID del admin | Campo poblado |
| TRAIL-03 | AuditTeamMember creado tiene `createdById` = ID del admin | Campo poblado |
| TRAIL-04 | PATCH miembro a `confirmed` → `confirmedAt` se puebla automáticamente | Timestamp presente |
| TRAIL-05 | PATCH miembro a `withdrawn` → `withdrawnAt` se puebla automáticamente | Timestamp presente |
| TRAIL-06 | `createdById` no puede ser sobreescrito desde el body | Ignorado — usa userId de sesión |

---

## Estrategia de datos de test

### Setup de tenant (para tests de integración)

```typescript
// beforeAll en cada suite
const companyA = await prisma.company.create({ data: { name: 'Tenant A' } });
const adminA = await prisma.user.create({
  data: { email: 'admin-a@test.com', password: '...', role: 'admin', companyId: companyA.id }
});
const companyB = await prisma.company.create({ data: { name: 'Tenant B' } });
const adminB = await prisma.user.create({
  data: { email: 'admin-b@test.com', password: '...', role: 'admin', companyId: companyB.id }
});
const userA = await prisma.user.create({
  data: { email: 'user-a@test.com', password: '...', role: 'user', companyId: companyA.id }
});
```

### Fixtures necesarias

| Fixture | Propósito |
|---------|---------|
| `auditorFactory(companyId)` | Crea un `Auditor` activo en el tenant indicado |
| `auditTeamFactory(companyId, projectId)` | Crea un `AuditTeam` en estado `forming` |
| `memberFactory(teamId, auditorId, role)` | Crea un `AuditTeamMember` en estado `invited` |
| `signedReportFactory(projectId, teamId)` | Crea un `AuditReport` con `status: signed` vinculado al equipo (para tests INV-09, INV-10) |

### Base de datos de test

Usar una base de datos PostgreSQL separada (nunca la de producción Neon). Opciones:
- **Neon branch** — crear un branch de test en el dashboard de Neon (recomendado para mantener paridad con producción)
- **PostgreSQL local** — Docker (`postgres:16-alpine`) para tests más rápidos y sin coste

Variable de entorno: `TEST_DATABASE_URL` separada de `DATABASE_URL`.

---

## Smoke tests — cambios a `scripts/smoke-routes.mjs`

Añadir al array `apiChecks`:

```javascript
{ path: "/api/admin/auditors", expectedStatus: 401, name: "auditors list without session" },
{ path: "/api/admin/audit-teams", expectedStatus: 401, name: "audit-teams list without session" },
```

Estos dos checks son seguros en producción: sin sesión, el endpoint devuelve 401 sin tocar datos. Verifican que las rutas están desplegadas y que el guard de autenticación funciona.

---

## Verificación manual antes de deploy (checklist)

Cuando no hay framework de integración disponible, ejecutar estos pasos manualmente contra el entorno de staging o producción con un usuario admin real:

- [ ] `POST /api/admin/auditors` — crear un auditor externo con email y nombre
- [ ] `GET /api/admin/auditors` — verificar que aparece en la lista
- [ ] `POST /api/admin/audit-teams` — crear un equipo para un proyecto existente
- [ ] `POST /api/admin/audit-teams/[id]/members` — asignar el auditor como `lead_auditor`
- [ ] `POST /api/admin/audit-teams/[id]/members` — intentar asignar un segundo `lead_auditor` → debe devolver 409
- [ ] `PATCH /api/admin/audit-teams/[id]/members/[id]` — cambiar estado a `confirmed`
- [ ] `PATCH /api/admin/audit-teams/[id]/members/[id]` — intentar retirar el único lead → debe devolver 409
- [ ] `PATCH /api/admin/auditors/[id]` — intentar suspender el auditor con asignación activa → debe devolver 403

---

## BAOS Compliance Test Obligations

- [ ] Aislamiento de tenant verificado (TENANT-01 a TENANT-06) — **pendiente framework de integración**
- [ ] Sin fuga de datos cross-tenant en endpoints de lista — **pendiente framework de integración**
- [ ] Invariants de negocio verificadas al nivel de API (INV-01 a INV-11) — **verificación manual disponible hoy**
- [ ] Audit trail (`createdById`, timestamps de estado) verificado (TRAIL-01 a TRAIL-06) — **pendiente framework de integración**
- [ ] Smoke checks de disponibilidad añadidos a `scripts/smoke-routes.mjs` — **implementable hoy**
- [ ] Aprobación humana requerida para cambios de estado de miembro — sin bypass posible vía API ✅

---

## Decisión requerida — Framework de integración

El proyecto no tiene Jest ni Vitest. Para ejecutar los tests de integración de este plan se necesita una decisión:

**Opción A — Jest + Supertest + Neon branch**
- Coste: ~2-3h de setup
- Ventaja: tests contra la misma infraestructura que producción
- Adecuado si BAOS va a requerir certificación formal

**Opción B — Vitest + Supertest + PostgreSQL local (Docker)**
- Coste: ~2-3h de setup
- Ventaja: más rápido en CI, sin coste de Neon
- Adecuado para desarrollo ágil

**Opción C — Aplazar hasta Phase 2**
- Los tests manuales del checklist cubren las invariants críticas hoy
- Los smoke tests cubren disponibilidad de endpoints
- La cobertura formal se añade cuando el volumen de componentes lo justifique

Pendiente decisión del usuario antes de implementar los tests de integración.

---

## Open Questions

1. **¿Framework de tests de integración?** — Ver sección "Decisión requerida" arriba.
2. **¿Base de datos de test?** — Neon branch vs Docker PostgreSQL. Depende de la decisión de framework.
3. **¿Los tests de integración corren en CI (GitHub Actions)?** — Si sí, necesitan `TEST_DATABASE_URL` como secret en el repositorio.
