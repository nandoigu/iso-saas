# Security Spec: Audit Team

> BAOS Component: Audit Runtime
> API Contract: docs/api-contracts/audit-team.md
> Domain Model: docs/domain-models/audit-team.md
> Date: 2026-07-01
> Status: Draft

---

## Authentication Requirements

| Endpoint | Auth requerida | Fuente de sesión |
|----------|---------------|-----------------|
| `GET /api/admin/auditors` | Sí | `getAuthSession(req)` — `app/lib/auth.ts` |
| `POST /api/admin/auditors` | Sí | Ídem |
| `GET /api/admin/auditors/[auditorId]` | Sí | Ídem |
| `PATCH /api/admin/auditors/[auditorId]` | Sí | Ídem |
| `GET /api/admin/audit-teams` | Sí | Ídem |
| `POST /api/admin/audit-teams` | Sí | Ídem |
| `GET /api/admin/audit-teams/[teamId]` | Sí | Ídem |
| `PATCH /api/admin/audit-teams/[teamId]` | Sí | Ídem |
| `POST /api/admin/audit-teams/[teamId]/members` | Sí | Ídem |
| `PATCH /api/admin/audit-teams/[teamId]/members/[memberId]` | Sí | Ídem |

**Sin sesión válida**: Devolver `401` inmediatamente — nunca revelar si el recurso existe o no.

**Sin acceso de auditores externos en Phase 1**: Los auditores registrados en el sistema no tienen endpoints propios para consultar sus asignaciones. Acceso exclusivo vía rol `admin`.

---

## RBAC Matrix

| Acción | rol `user` | rol `admin` | Notas |
|--------|-----------|------------|-------|
| Listar auditores | ❌ | ✅ | Scoped a `companyId` del admin |
| Crear auditor | ❌ | ✅ | `companyId` inyectado desde sesión |
| Ver detalle de auditor | ❌ | ✅ | 404 si no pertenece al tenant |
| Editar auditor | ❌ | ✅ | Incluye cambio de `status` |
| Suspender/retirar auditor | ❌ | ✅ | Bloqueado si tiene asignaciones activas |
| Listar equipos | ❌ | ✅ | Scoped a `companyId` |
| Crear equipo | ❌ | ✅ | Valida que `projectId` pertenezca al tenant |
| Ver detalle de equipo | ❌ | ✅ | Con miembros incluidos |
| Editar equipo | ❌ | ✅ | Bloqueado si report asociado está firmado |
| Añadir miembro al equipo | ❌ | ✅ | Valida invariant lead_auditor único |
| Cambiar estado de miembro | ❌ | ✅ | Bloqueado si retira lead sin sucesor |

**No existe bypass de RBAC a nivel de UI**: el control se aplica en el route handler, no en el componente React. Un usuario `user` que llame directamente al endpoint recibe `403`.

---

## Tenant Isolation Requirements

| Requisito | Implementación |
|-----------|---------------|
| Todas las queries de lectura están acotadas | `WHERE companyId = session.companyId` en cada Prisma call |
| Todas las operaciones de escritura están acotadas | `companyId` inyectado desde sesión — nunca desde body o query param |
| Cross-tenant devuelve 404, no 403 | La existencia de un recurso de otro tenant no debe revelarse |
| Validación cruzada de referencias | `projectId` y `auditorId` se validan contra `companyId` del admin antes de cualquier escritura |
| Operaciones en cadena | Al añadir un miembro: primero verificar que el equipo pertenece al tenant, luego que el auditor también |

**Breach pattern a evitar**: cualquier query sin `companyId` en el `where` es una fuga de aislamiento. Ejemplo incorrecto:
```typescript
// MAL — devuelve auditores de todos los tenants
prisma.auditor.findMany({ where: { status: 'active' } })

// BIEN
prisma.auditor.findMany({ where: { companyId: user.companyId, status: 'active' } })
```

---

## Sensitive Data Inventory

| Campo | Entidad | Sensibilidad | Protección requerida |
|-------|---------|-------------|---------------------|
| `certificationNumber` | `Auditor` | Dato profesional regulado (potencial RGPD art. 9) | No incluir en logs · Pendiente decisión de cifrado (ver Open Questions) |
| `email` | `Auditor` | PII personal | No incluir en logs de error · Respuestas acotadas a admin |
| `phone` | `Auditor` | PII personal | No incluir en logs de error |
| `notes` | `Auditor`, `AuditTeamMember` | Puede contener observaciones sensibles sobre el profesional | No incluir en logs · Solo visible para admin |
| `withdrawnReason` | `AuditTeamMember` | Puede contener motivos disciplinarios o legales | No incluir en logs · Solo visible para admin |

**Reglas de logging**:
- Nunca registrar valores de los campos anteriores en `console.log`, `console.error` ni Vercel logs
- Los mensajes de error devueltos al cliente no deben incluir detalles de Prisma (`PrismaClientKnownRequestError`, `constraint`, `unique`) — solo mensajes en español genéricos
- Los IDs de registros de otros tenants no deben aparecer en respuestas de error

**Respuestas que NO deben incluir datos sensibles**:
```typescript
// MAL — filtra detalles internos
return NextResponse.json({ error: error.message }, { status: 500 })

// BIEN
console.error('ERROR POST /api/admin/auditors:', error)
return NextResponse.json({ error: 'No se pudo registrar el auditor.' }, { status: 500 })
```

---

## Audit Trail Requirements

| Evento | Qué registrar | Dónde |
|--------|--------------|-------|
| Auditor creado | `createdAt`, `createdById` (userId del admin) | Campo en entidad `Auditor` |
| Auditor modificado | `updatedAt` automático vía Prisma | Campo en entidad `Auditor` |
| Auditor suspendido/retirado | Cambio de `status` con `updatedAt` | Campo en entidad `Auditor` |
| Equipo constituido | `formedAt`, `createdAt`, `createdById` | Campo en entidad `AuditTeam` |
| Miembro asignado | `assignedAt`, `createdById` | Campo en entidad `AuditTeamMember` |
| Miembro confirmado | `confirmedAt` | Campo en entidad `AuditTeamMember` |
| Miembro retirado | `withdrawnAt`, `withdrawnReason` | Campo en entidad `AuditTeamMember` |

**`createdById` es obligatorio en toda entidad creada** — el servicio debe recibir `user.id` de la sesión y almacenarlo. Nunca confiar en un `createdById` recibido del cliente.

**Inmutabilidad de equipo en report firmado** (invariant #5): una vez que un `AuditReport` vinculado alcanza `status = signed`, ninguna mutación sobre `AuditTeamMember` de ese equipo es permitida. El servicio debe verificar este estado antes de cualquier PATCH sobre miembros.

---

## Invariants de negocio con implicaciones de seguridad

Estas reglas deben aplicarse en la capa de servicio (`audit-team.service.ts`), no en el route handler ni en el cliente. Son invariants de integridad del sistema de auditoría — su violación comprometería la trazabilidad certificable.

| Invariant | Dónde verificar | Respuesta si se viola |
|-----------|----------------|----------------------|
| Un único `lead_auditor` activo por equipo | `audit-team.service.ts` — antes de crear `AuditTeamMember` | `409 Conflict` |
| Retirar `lead_auditor` sin sucesor confirmado | `audit-team.service.ts` — antes de actualizar `status = withdrawn` | `409 Conflict` |
| Auditor con asignaciones activas no suspendible | `audit-team.service.ts` — antes de actualizar `Auditor.status` | `403 Forbidden` |
| Equipo de report firmado es inmutable | `audit-team.service.ts` — antes de cualquier mutación de miembro | `403 Forbidden` |

**Estas verificaciones deben ejecutarse dentro de una transacción Prisma** cuando implican múltiples operaciones relacionadas (ej. retirar lead y nombrar sucesor en el mismo acto).

---

## External Service Dependencies

| Servicio | Propósito | Credencial | Modo de fallo |
|---------|----------|-----------|--------------|
| Neon PostgreSQL | Persistencia de todas las entidades | `DATABASE_URL` | Componente no disponible — 500 al cliente |
| Vercel (runtime) | Ejecución de route handlers | — (infraestructura) | Auto-reinicio serverless |

**Sin dependencias de servicios externos adicionales** en Phase 1: no se envían emails al crear/modificar auditores ni equipos. Sin llamadas a IA ni a servicios de terceros.

---

## Environment Variables Required

| Variable | Requerida | Estado | Notas |
|----------|----------|--------|-------|
| `DATABASE_URL` | Sí | ✅ Ya configurada en Vercel | Conexión Neon PostgreSQL |
| `AUTH_SECRET` | Sí | ✅ Ya configurada en Vercel | Firma de cookies de sesión |

**No se requieren nuevas variables de entorno** para este componente en Phase 1.

---

## Deployment Requirements

| Requisito | Detalle |
|-----------|---------|
| Plataforma | Vercel — auto-deploy desde `main` |
| Runtime | Node.js serverless estándar |
| BD | Neon PostgreSQL — sin cambios de configuración de conexión |
| Timeout | 10s por defecto — suficiente para las operaciones de este componente |
| Migración | `prisma migrate deploy` requerida antes del primer deploy — añade tablas `Auditor`, `AuditTeam`, `AuditTeamMember` y columna `AuditReport.auditTeamId` |
| Cron | No requerido para este componente |
| Orden de deploy | Migración primero → deploy de código → smoke test |

**Dependencia de migración**: los route handlers de este componente fallarán con error de Prisma si se despliegan antes de ejecutar la migración. El orden es estricto.

---

## Operational Notes

### Verificar que el componente funciona en producción

```powershell
# Listar auditores del tenant (requiere cookie de sesión admin)
curl -s https://iso-saas-gamma.vercel.app/api/admin/auditors `
  -H "Cookie: bmo_session=<cookie-de-sesion-admin>" | ConvertFrom-Json | Select-Object -ExpandProperty data | Measure-Object
```

Resultado esperado: `Count` igual al número de auditores registrados (0 en un tenant nuevo).

### Diagnosticar fallos

1. **401 inesperado**: verificar que la cookie `bmo_session` está presente y no ha expirado (TTL 7 días)
2. **403 inesperado**: verificar que el usuario tiene `role = admin` en BD
3. **409 al añadir miembro**: revisar si ya existe un `lead_auditor` activo en ese equipo
4. **500 en queries**: revisar logs de Vercel Functions — buscar `ERROR POST /api/admin/audit-teams` o `ERROR PATCH /api/admin/auditors`
5. **Prisma error en producción**: probablemente la migración no se ejecutó — verificar con `prisma migrate status`

### Procedimiento de rollback

Si este componente causa un problema en producción:
1. Revertir el commit en GitHub — Vercel redesplegará automáticamente el código anterior
2. Si la migración ya fue aplicada y hay datos: **no ejecutar rollback de migración** — los datos de auditores y equipos deben preservarse
3. Si la migración aún no tenía datos reales: `prisma migrate resolve --rolled-back <nombre-de-migracion>`
4. Verificar con smoke tests tras el rollback

---

## BAOS Security Compliance Checklist

- [x] RBAC aplicado en el route handler — no solo en la UI
- [x] Acceso exclusivo `admin` en Phase 1 — sin rutas públicas ni de usuario estándar
- [x] Aislamiento de tenant verificado en todas las queries de lectura y escritura
- [x] `companyId` siempre inyectado desde sesión, nunca desde el cliente
- [x] Cross-tenant devuelve 404 (no 403) — la existencia de recursos ajenos no se revela
- [x] `createdById` registrado en todas las entidades nuevas (governance trail)
- [x] Invariants de negocio aplicadas en la capa de servicio (no en route handler ni BD)
- [x] Invariants ejecutadas en transacción Prisma cuando implican múltiples operaciones
- [x] Datos sensibles (`certificationNumber`, `email`, `phone`, `notes`, `withdrawnReason`) no incluidos en logs
- [x] Mensajes de error al cliente en español genérico — sin detalles de Prisma ni IDs internos
- [x] Sin nuevas variables de entorno requeridas
- [x] Migración debe ejecutarse antes del deploy de código
- [x] Cifrado de `certificationNumber`: cifrado en reposo de Neon suficiente — no es categoría especial RGPD
- [ ] Tests TENANT-01/02/03 de aislamiento pendientes (cubiertos por test-plan)
- [ ] Acceso de auditor externo a sus propias asignaciones — fuera de scope en Phase 1, requiere ADR en Phase 2

---

## Open Questions

1. **¿Cifrado de `certificationNumber` en base de datos?**
   ✅ **Resuelto (2026-07-01)**: Confiar en el cifrado en reposo de Neon (AES-256 a nivel de disco).
   `certificationNumber` es un identificador administrativo profesional — no es categoría especial bajo RGPD art. 9. La protección real viene del control de acceso (solo `admin`) y del aislamiento de tenant, ya definidos en este spec. El cifrado a nivel de aplicación añadiría complejidad (gestión de clave, campo no buscable) sin beneficio proporcional para este tipo de dato. Si un cliente específico exige cifrado adicional en el futuro, se añade como extensión por tenant.

2. **¿Acceso de auditores externos a sus propias asignaciones en fases posteriores?**
   En Phase 1 no existe. Si se implementa en Phase 2, requiere un mecanismo de invitación por token temporal (sin crear un `User` completo en el sistema). Registrar como ADR cuando se decida.

3. **¿Log de auditoría en tabla dedicada?**
   Actualmente el trail se basa en campos `createdAt/updatedAt/createdById` en las propias entidades. Para certificación ISO, podría requerirse una tabla `AuditLog` independiente (inmutable, append-only). Pendiente validación de requisito de certificación.
