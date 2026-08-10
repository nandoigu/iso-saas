# Security Spec: Evidence Graph

> BAOS Component: Evidence Graph
> API Contract: docs/api-contracts/evidence-graph.md
> Domain Model: docs/domain-models/evidence-graph.md
> ADR: docs/adr/ADR-003-evidence-graph-phase1-scoping.md · docs/adr/ADR-004-evidence-graph-implementation-decisions.md
> Date: 2026-07-01 (revisado 2026-08-05 — ADR-004)
> Status: Draft

---

## Authentication Requirements

| Endpoint | Auth requerida | Fuente de sesión |
|----------|---------------|-----------------|
| `GET /api/projects/[projectId]/evidence` | Sí | `getAuthSession(req)` — `app/lib/auth.ts` |
| `POST /api/projects/[projectId]/evidence` | Sí | Ídem |
| `GET /api/evidence/[evidenceId]` | Sí | Ídem |
| `PATCH /api/evidence/[evidenceId]` | Sí | Ídem |
| `DELETE /api/evidence/[evidenceId]` | Sí | Ídem |
| `POST /api/projects/[projectId]/evidence/upload-token` | Sí | Ídem |
| `POST /api/evidence/[evidenceId]/submit` | Sí | Ídem |
| `GET /api/evidence/[evidenceId]/file` | Sí | Ídem |
| `POST /api/admin/evidence/[evidenceId]/requirement-links` | Sí | Ídem |
| `DELETE /api/admin/evidence/[evidenceId]/requirement-links/[linkId]` | Sí | Ídem |
| `POST /api/admin/evidence/[evidenceId]/validate` | Sí | Ídem |
| `POST /api/admin/evidence/[evidenceId]/report-links` | Sí | Ídem |

**Sin sesión válida**: devolver `401` inmediatamente — nunca revelar si el recurso existe.

**Diferencia clave con Audit Team**: este componente no es admin-only en su totalidad. El dueño del proyecto sube, presenta y gestiona su propia evidencia (`draft`/`submitted`) y puede abrir su propio archivo; solo las acciones que comprometen la integridad certificable de la auditoría (vínculo normativo, validación, cita en informe) exigen `admin`.

**Convención de rutas (ADR-004, decisión #2)**: toda ruta bajo `/api/admin/` exige `role === 'admin'`, sin excepciones; una ruta fuera de ese prefijo no lo exige. El control sigue aplicándose en el handler — el prefijo no es el mecanismo, es la garantía legible de un vistazo. Las rutas de esta tabla ya reflejan la realineación: `file` salió de `/api/admin/` y `requirement-links` entró.

---

## RBAC Matrix

| Acción | rol `user` (dueño del proyecto) | rol `admin` | Notas |
|--------|:---:|:---:|-------|
| Listar evidencia del proyecto | ✅ | ✅ | Scoped a `project.userId`; admin ve todo |
| Crear evidencia (`draft`) | ✅ | ✅ | `projectId` de la ruta, `createdBy` de sesión |
| Obtener token de subida al Blob | ✅ | ✅ | Punto crítico: verifica sesión, rol y pertenencia del proyecto ANTES de firmar |
| Presentar evidencia (`draft → submitted`) | ✅ | ✅ | Acto del auditado — bloqueado si `status ≠ draft` |
| Ver detalle de evidencia | ✅ | ✅ | 404 si no pertenece al tenant |
| Editar evidencia | ✅ | ✅ | Bloqueado si `status ∈ {validated, archived}` |
| Eliminar evidencia | ✅ | ✅ | Bloqueado si tiene `EvidenceReportLink` |
| Vincular a `Requirement` | ❌ | ✅ | Vínculo normativo — criterio de auditor |
| Desvincular de `Requirement` | ❌ | ✅ | Ídem |
| Validar evidencia (aprobar/rechazar) | ❌ | ✅ | Punto de control humano obligatorio (invariant #1) |
| Citar en `AuditReport` | ❌ | ✅ | Requiere `status = validated` |
| Obtener signed URL del archivo | ✅ | ✅ | Solo si es dueño del proyecto o admin |

**No existe bypass de RBAC a nivel de UI**: el control se aplica en el route handler. Un `user` que llame directamente a un endpoint `admin only` recibe `403`.

---

## Tenant Isolation Requirements

| Requisito | Implementación |
|-----------|---------------|
| Todas las queries de lectura están acotadas | `project.userId === user.id` (o sin filtro si `admin`) — mismo patrón que `Requirement`, NO `companyId` (ADR-003, decisión #2: Evidence Graph queda scoped por proyecto, no por company) |
| Todas las operaciones de escritura están acotadas | `projectId` viene de la ruta y se valida contra el proyecto del usuario antes de escribir; nunca se acepta `projectId` para reasignar una evidencia existente |
| Cross-tenant devuelve 404, no 403 | La existencia de evidencia de otro usuario/proyecto no debe revelarse |
| Validación cruzada de referencias | `requirementId` (en requirement-links) y `auditReportId` (en report-links) se validan contra el mismo `projectId`/tenant que la evidencia antes de crear el vínculo |
| Endpoints admin-only | Verifican `role === 'admin'` DESPUÉS de la verificación de sesión, ANTES de tocar Prisma |

**Breach pattern a evitar**:
```typescript
// MAL — devuelve evidencia de todos los proyectos
prisma.evidenceItem.findMany({ where: { status: 'validated' } })

// BIEN
prisma.evidenceItem.findMany({
  where: {
    status: 'validated',
    ...(isAdminRole(user.role) ? {} : { project: { userId: user.id } }),
  },
})
```

---

## Sensitive Data Inventory

| Campo | Entidad | Sensibilidad | Protección requerida |
|-------|---------|-------------|---------------------|
| `sourceRef` | `EvidenceItem` | Referencia a documento potencialmente confidencial (BEP, procedimiento firmado, log de sistema) | Nunca se expone como URL pública — solo signed URL de corta duración (ADR-003) · No incluir en logs |
| `snapshot` (JSON) | `EvidenceItemVersion` | Copia completa del estado de la evidencia en un momento dado, incluye `sourceRef` y `description` | Mismo nivel de protección que `EvidenceItem` · No incluir en logs |
| `description` | `EvidenceItem` | Puede contener detalle operativo sensible del proyecto auditado | No incluir en logs de error |
| `notes` | `EvidenceValidation` | Puede contener observaciones de auditor sobre por qué se rechazó/cuestionó una evidencia | No incluir en logs · Solo visible para el dueño del proyecto y admin |
| `changeReason` | `EvidenceItemVersion` | Similar a `notes` | No incluir en logs |

**Reglas de logging**:
- Nunca registrar valores de los campos anteriores en `console.log`, `console.error` ni logs de Vercel
- Los mensajes de error al cliente no deben incluir detalles de Prisma ni el `sourceRef`/`pathname` real de Blob
- Los IDs de evidencia de otros tenants no deben aparecer en respuestas de error

```typescript
// MAL
return NextResponse.json({ error: error.message }, { status: 500 })

// BIEN
console.error('ERROR POST /api/evidence:', error)
return NextResponse.json({ error: 'No se pudo registrar la evidencia.' }, { status: 500 })
```

**Cifrado de `sourceRef` y `snapshot`**: resuelto — ver Open Questions #1.

---

## Audit Trail Requirements

| Evento | Qué registrar | Dónde |
|--------|--------------|-------|
| Evidencia creada | `createdAt`, `createdBy` | Campo en `EvidenceItem` |
| Evidencia modificada | Snapshot completo + `changeReason` | `EvidenceItemVersion` (invariant #4/#5) |
| Evidencia vinculada a requisito | `addedAt`, `addedBy`, `linkType` | `EvidenceRequirementLink` |
| Evidencia vinculada a informe | `addedAt`, `addedBy`, `usedAs` | `EvidenceReportLink` |
| Decisión de validación | `outcome`, `notes`, `validatedAt`, `validatedBy` | `EvidenceValidation` — nunca sobrescrita, siempre un nuevo registro |
| Evidencia eliminada | Bloqueado si citada en informe; si se permite, el registro desaparece — no hay soft delete | Ver invariant #3 |

**`validatedBy` es obligatorio y no nulo en `EvidenceValidation`** — el servicio debe recibir `user.id` de la sesión autenticada como `admin`. Nunca aceptar `validatedBy` del body (previene que un actor se auto-atribuya una validación de otro admin).

**`createdBy`/`addedBy` nunca aceptados del cliente** — siempre inyectados desde la sesión.

---

## Invariants de negocio con implicaciones de seguridad

Estas reglas se aplican en `evidence.service.ts`, no en el route handler ni en el cliente.

| Invariant | Dónde verificar | Respuesta si se viola |
|-----------|----------------|----------------------|
| `status = validated` requiere `EvidenceValidation.outcome = approved` (#1) | Antes de cualquier transición a `validated` | El estado solo cambia vía `POST .../validate` — no existe otra vía |
| `EvidenceReportLink` requiere `status = validated` (#2) | `POST .../report-links` | `409 Conflict` |
| Evidencia citada en informe es inmutable — no eliminable (#3) | `DELETE /api/evidence/[id]` | `409 Conflict` |
| `EvidenceItemVersion.version` monotónico, no reutilizable (#4) | `PATCH /api/evidence/[id]` — dentro de transacción Prisma | Error 500 si se detecta colisión (no debería ocurrir con lógica correcta) |
| `EvidenceItem.version` = máximo `EvidenceItemVersion.version` (#5) | Igual que arriba | Igual |
| `linkType = contradictory` fuerza `status = under_review` (#6) | `POST .../requirement-links` | Side effect automático, no bloqueante |
| `EvidenceReportLink` bloqueado si el informe está cerrado — `AuditReport.status = signed` o `finalizado` (#7) | `POST .../report-links` | `409 Conflict` |
| Evidencia con status `validated`/`archived` inmutable por `PATCH` | `PATCH /api/evidence/[id]` | `409 Conflict` |

**Las verificaciones de #1, #2 y #7 deben ejecutarse dentro de una transacción Prisma** cuando implican leer un estado y escribir en la misma operación (evita race conditions entre dos admins operando sobre la misma evidencia).

---

## External Service Dependencies

| Servicio | Propósito | Credencial | Modo de fallo |
|---------|----------|-----------|--------------|
| Neon PostgreSQL | Persistencia de las 5 entidades del Evidence Graph | `DATABASE_URL` | Componente no disponible — 500 al cliente |
| Vercel Blob | Almacenamiento del archivo fuente referenciado por `sourceRef` (ADR-003) | `BLOB_READ_WRITE_TOKEN` | Sin acceso a archivos — el registro de evidencia y su ciclo de validación siguen operativos (degradación parcial, no total) |
| Vercel (runtime) | Ejecución de route handlers y generación de signed URLs | — (infraestructura) | Auto-reinicio serverless |

**Nueva dependencia externa respecto a Audit Team**: Vercel Blob. Es la primera vez que este proyecto almacena archivos binarios fuera de Neon — requiere aprovisionar el store antes del deploy.

---

## Environment Variables Required

| Variable | Requerida | Estado | Notas |
|----------|----------|--------|-------|
| `DATABASE_URL` | Sí | ✅ Ya configurada en Vercel | Conexión Neon PostgreSQL |
| `AUTH_SECRET` | Sí | ✅ Ya configurada en Vercel | Firma de cookies de sesión |
| `BLOB_READ_WRITE_TOKEN` | Sí | ✅ Aprovisionada (2026-07-01) · **rotada el 2026-08-10** | Store privado **`iso-saas-evidence-fra`** (`store_wyhryJCIVwjFEuMw`, región **`fra1`**), vinculado al proyecto `iso-saas`. Token en Production, Preview y Development |

⚠️ **Cambio de región el 2026-08-10 (ADR-007)**: el store original `iso-saas-evidence` (`store_SPJ4WiRGmr7N39TV`) estaba en **`iad1` — Washington**, fuera de la UE, por el valor por defecto de `--region` en el CLI. Como **la región de un store es inmutable**, no se cambió: se creó otro en `fra1` y se borró el anterior, que seguía con **0 ficheros**. El token cambió, así que cualquier `.env.local` anterior a esa fecha apunta a un store que ya no existe: hay que hacer `vercel env pull`.

**Acción requerida antes de implementar**: instalar la dependencia `@vercel/blob` — el store y el token existen, pero el paquete **no está en `package.json`** (verificado 2026-08-05). Sin él no hay ni emisión de token de subida ni generación de signed URL.

⚠️ **Gotcha documentado**: `vercel blob create-store --yes` dispara un `vercel env pull` que **sobrescribe `.env.local` entero** con las vars scoped a `development`. Hacer copia de seguridad de `.env.local` antes de ejecutar cualquier comando `vercel blob` o `vercel env`.

---

## Deployment Requirements

| Requisito | Detalle |
|-----------|---------|
| Plataforma | Vercel — auto-deploy desde `main` |
| Runtime | Node.js serverless estándar |
| BD | Neon PostgreSQL — sin cambios de configuración de conexión |
| Storage | Vercel Blob — store privado, nuevo en este componente |
| Timeout | 10s por defecto — suficiente; la generación de signed URL es una operación rápida, no hace proxy del archivo |
| Migración | `prisma migrate deploy` requerida antes del primer deploy — añade `EvidenceItem`, `EvidenceRequirementLink`, `EvidenceReportLink`, `EvidenceValidation`, `EvidenceItemVersion` y back-relations |
| Cron | No requerido para este componente |
| Dependencia | `@vercel/blob` — pendiente de instalar (`npm i @vercel/blob`) |
| Orden de deploy | 1) Store de Blob + `BLOB_READ_WRITE_TOKEN` (✅ hecho) → 2) Instalar `@vercel/blob` → 3) Migración Prisma → 4) Deploy de código → 5) Smoke test |

---

## Operational Notes

### Verificar que el componente funciona en producción

```powershell
# Listar evidencia de un proyecto (requiere cookie de sesión válida, dueño del proyecto o admin)
curl -s "https://iso-saas-gamma.vercel.app/api/projects/<projectId>/evidence" `
  -H "Cookie: bmo_session=<cookie-de-sesion>" | ConvertFrom-Json | Select-Object -ExpandProperty data | Measure-Object
```

Resultado esperado: `Count` igual al número de evidencias registradas en ese proyecto (0 en un proyecto nuevo).

### Diagnosticar fallos

1. **401 inesperado**: verificar que la cookie `bmo_session` está presente y no ha expirado
2. **403 en endpoints admin-only**: verificar `role = admin` en BD para el usuario
3. **404 en `GET .../file`**: revisar que `sourceRef` no esté vacío y que el `pathname` exista en el store de Vercel Blob
4. **409 en `POST .../report-links`**: revisar que `EvidenceItem.status = validated` y que el `AuditReport` destino no esté cerrado (`signed`/`finalizado`)
5. **500 en `GET .../file`**: probable fallo de `BLOB_READ_WRITE_TOKEN` ausente o expirado — revisar variables de entorno en Vercel
6. **500 en queries generales**: revisar logs de Vercel Functions — buscar `ERROR POST /api/evidence` o `ERROR PATCH /api/evidence`
7. **Prisma error en producción**: la migración probablemente no se ejecutó — verificar con `prisma migrate status`

### Procedimiento de rollback

1. Revertir el commit en GitHub — Vercel redesplegará automáticamente el código anterior
2. Si la migración ya fue aplicada y hay datos: **no ejecutar rollback de migración** — los datos de evidencia deben preservarse (evidence-first: perder evidencia es peor que un bug de código)
3. Si la migración aún no tenía datos reales: `prisma migrate resolve --rolled-back <nombre-de-migracion>`
4. El store de Vercel Blob no se revierte — los archivos ya subidos permanecen, huérfanos si el rollback elimina las referencias en BD; documentar para limpieza manual posterior
5. Verificar con smoke tests tras el rollback

---

## BAOS Security Compliance Checklist

- [x] RBAC aplicado en el route handler — no solo en la UI
- [x] Acceso mixto (`user` dueño + `admin`) correctamente segmentado por endpoint — no todo es admin-only
- [x] Aislamiento de tenant verificado en todas las queries (`project.userId`, no `companyId` — ver ADR-003 #2)
- [x] `projectId`/`createdBy`/`addedBy`/`validatedBy` siempre inyectados desde sesión o ruta, nunca del cliente
- [x] Cross-tenant devuelve 404 (no 403)
- [x] `EvidenceItemVersion` registrado en cada mutación de contenido (governance trail)
- [x] Ninguna transición a `validated`/`rejected` sin `EvidenceValidation.validatedBy` humano
- [x] Archivo fuente servido solo vía signed URL de corta duración — nunca URL pública
- [x] Invariants de negocio aplicadas en la capa de servicio, con transacción donde aplica
- [x] Datos sensibles (`sourceRef`, `snapshot`, `description`, `notes`, `changeReason`) excluidos de logs
- [x] Mensajes de error al cliente sin detalles de Prisma ni de Blob
- [x] Nueva variable de entorno (`BLOB_READ_WRITE_TOKEN`) documentada y aprovisionada — falta solo instalar `@vercel/blob`
- [x] Prefijo `/api/admin/` = admin-only sin excepciones (ADR-004 #2)
- [x] La ruta emisora del token de subida se trata como endpoint de escritura de pleno derecho, con sus propios tests de aislamiento de tenant (ADR-004 #3)
- [x] Migración debe ejecutarse antes del deploy de código, y el store de Blob antes de la migración
- [x] Cifrado de `sourceRef`/`snapshot`: resuelto — Neon at-rest + Vercel Blob at-rest suficiente para Phase 1 (ver Open Questions)
- [ ] Tests TENANT-01/02/03 de aislamiento pendientes (cubiertos por test-plan)

---

## Open Questions

1. **¿Cifrado adicional de `sourceRef` y `snapshot` a nivel de aplicación?**
   ✅ **Resuelto (2026-07-01)**: No se añade cifrado a nivel de aplicación en Phase 1. `sourceRef` es un `pathname`, no el contenido del documento; el binario real vive en Vercel Blob (store privado, cifrado en reposo por la propia plataforma) y el registro en Neon también está cifrado en reposo. La protección efectiva viene del control de acceso (signed URL de corta duración + verificación de tenant), consistente con la decisión ya tomada para `certificationNumber` en `docs/security-specs/audit-team.md` — mismo razonamiento: complejidad de gestión de clave sin beneficio proporcional para Phase 1. Si un cliente enterprise exige cifrado adicional por contrato, se aborda como extensión por tenant en una fase posterior.

2. **¿Rate limiting en `GET .../file`?**
   No implementado en Phase 1 — no hay infraestructura de rate limiting en el proyecto (`Vercel Firewall` no configurado). Riesgo aceptado: un usuario autenticado podría generar múltiples signed URLs de su propia evidencia sin límite. No es una fuga cross-tenant, solo un costo operativo menor. Revisar si el volumen de uso lo justifica.

3. **¿Reutilización del token `BLOB_READ_WRITE_TOKEN` entre Preview y Production?**
   Vercel genera tokens separados por entorno al crear el store vinculado al proyecto. Usar el token de Preview para pruebas evita que un entorno de desarrollo escriba sobre el store de producción. Verificar en el dashboard que ambos entornos tengan su propio token antes del primer deploy.
