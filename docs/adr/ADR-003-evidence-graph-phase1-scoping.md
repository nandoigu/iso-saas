# ADR-003: Evidence Graph Phase 1 Scoping Decisions

## Status

Accepted

## Date

2026-07-01

## Context

El component spec del Evidence Graph (`docs/component-specs/evidence-graph.md`) dejó cuatro preguntas abiertas heredadas del domain model (`docs/domain-models/evidence-graph.md`). Las cuatro deben resolverse antes de escribir el api-contract, porque afectan directamente la forma de `sourceRef`, el alcance de tenant de `EvidenceItem`, y la migración Prisma.

Se investigó el estado real del repositorio antes de decidir:

- No existe ninguna integración de storage de archivos (`@vercel/blob`, `aws-sdk`, `multer`, etc.) en `package.json` ni en el código. El proyecto despliega en Vercel y ya usa Vercel Cron.
- El campo `Requirement.evidencia` (texto libre) se usa activamente en 21 archivos de producción: páginas de proyecto, matriz, dashboard, generación de informes de auditoría, importación/exportación Excel y PDF.
- `Requirement` — el modelo más cercano en forma al nuevo `EvidenceItem` — está aislado por `projectId`, no por `companyId`. `Company` es opcional y delgado en el schema actual.
- El Contradiction Engine no existe todavía como componente implementado; es un Core Component futuro de BAOS.

## BAOS Principles Affected

- **Evidence-first** — la elección de storage y el alcance de tenant determinan si una evidencia puede perderse o filtrarse entre proyectos.
- **Multi-tenant isolation** — el alcance de `EvidenceItem` debe respetar el mismo patrón de aislamiento que el resto del schema, no inventar uno nuevo.
- **Governance-first** — no introducir infraestructura (colas, tablas de trigger) para un componente (Contradiction Engine) que aún no existe.
- **Security by design** — el storage de documentos de evidencia (BEPs, procedimientos firmados) requiere control de acceso, no URLs públicas.

## Decisions

### 1. Almacenamiento de archivos → Vercel Blob, acceso privado

`EvidenceItem.sourceRef` almacena el `pathname` de Vercel Blob (no la URL pública directa). El acceso a los binarios se sirve a través de una ruta interna (`app/api/admin/evidence/[id]/file`) que genera una signed URL de corta duración vía `@vercel/blob`, verificando antes la pertenencia del `EvidenceItem` al proyecto del usuario autenticado.

**Rationale**: el proyecto ya está desplegado en Vercel (Vercel Cron, auto-deploy desde `main`); Vercel Blob no añade un proveedor nuevo ni credenciales adicionales, y soporta stores privados con URLs firmadas, cumpliendo "security by design" sin construir una integración de DMS externo que Phase 1 no necesita.

### 2. Reutilización de evidencia entre proyectos → NO en Phase 1, scope de `Project`

`EvidenceItem` permanece acotado a un único `projectId`, igual que `Requirement`. No se promueve a scope de `Company` en esta fase.

**Rationale**: introducir scope de `Company` ahora significaría diseñar una segunda estrategia de aislamiento de tenant en paralelo a la que ya usa `Requirement`, sin que exista todavía un caso de uso confirmado que lo requiera (violaría "no diseñar para requisitos hipotéticos futuros"). Si en Phase 2 se confirma la necesidad real de reutilizar evidencia corporativa entre proyectos, se abordará con un ADR específico de promoción de scope, no de forma anticipada aquí.

### 3. Notificación al Contradiction Engine → solo flag de estado, sin infraestructura de eventos

Cuando `EvidenceRequirementLink.linkType = "contradictory"`, el servicio transiciona `EvidenceItem.status` a `"under_review"` (ya especificado como invariante #6 del domain model). No se crea una tabla `ContradictionTrigger` ni se introduce una cola de mensajes en esta fase.

**Rationale**: el Contradiction Engine no está implementado todavía. Construir infraestructura de eventos para un consumidor que no existe es sobre-ingeniería. Cuando el Contradiction Engine se implemente, puede consultar directamente por `EvidenceItem.status = "under_review"` combinado con `EvidenceRequirementLink.linkType = "contradictory"`; la migración a un evento real (webhook interno, cola) es una decisión que le corresponde a ese componente cuando exista, sin requerir cambio de schema en el Evidence Graph.

### 4. Campo legado `Requirement.evidencia` → se mantiene sin cambios en Phase 1

`Requirement.evidencia` no se deprecia, no se migra y no se toca en la migración Prisma del Evidence Graph.

**Rationale**: el campo está en uso activo en 21 archivos de producción (UI de proyecto, matriz, dashboard, generación y exportación de informes). Deprecarlo ahora rompería flujos productivos vigentes sin beneficio inmediato. Queda como resumen legible en paralelo al grafo estructurado; el backfill formal hacia `EvidenceRequirementLink` (si se decide) es una tarea de migración de datos de Phase 2, fuera del alcance de esta migración aditiva.

## Alternatives Considered

### Storage: URLs públicas de Vercel Blob

Descartado — expondría documentos de auditoría (potencialmente confidenciales) sin control de acceso, violando "security by design".

### Storage: DMS externo (SharePoint, Google Drive API)

Descartado para Phase 1 — añade una integración OAuth completa y credenciales de terceros que no aportan valor frente a Vercel Blob en esta fase; queda abierto como opción de Phase 2 si el cliente enterprise lo requiere contractualmente.

### Tenant scope: promover `EvidenceItem` a `Company` desde el inicio

Descartado — no hay caso de uso confirmado de reutilización cross-proyecto; anticiparlo introduce una segunda estrategia de aislamiento sin necesidad probada.

### Contradiction: tabla `ContradictionTrigger` + cola desde ya

Descartado — construir infraestructura para un consumidor inexistente. Se puede añadir sin romper compatibilidad cuando el Contradiction Engine exista, dado que el flag ya persiste toda la información necesaria.

### Legacy field: deprecar `Requirement.evidencia` ahora con migración de datos

Descartado — alto radio de impacto (21 archivos) para un beneficio que no es urgente; se revisita en Phase 2 con un ADR propio si se decide unificar.

## Consequences

### Positive
- Cero proveedores nuevos: Vercel Blob se integra con el mismo despliegue existente.
- El alcance de tenant de `EvidenceItem` es consistente con el patrón ya validado de `Requirement`, sin deuda de diseño paralela.
- No se construye infraestructura para componentes que todavía no existen (Contradiction Engine).
- Cero riesgo de regresión sobre los 21 archivos que dependen de `Requirement.evidencia`.

### Negative
- Si en Phase 2 se confirma la necesidad de evidencia cross-proyecto, migrar `EvidenceItem` de scope `Project` a `Company` requerirá una migración de datos adicional (no solo de schema).
- El acceso a archivos vía signed URL de corta duración añade una ruta interna extra (`.../file`) en vez de servir la URL directamente.

### Risks
- **Vercel Blob store privado mal configurado** podría exponer URLs públicas por error de configuración. Mitigación: verificar explícitamente `access: 'private'` (o equivalente) en el security-spec y en el test plan.
- **Migración futura de scope Project → Company** (si Q2 cambia) requiere backfill de `projectId` a `companyId` en `EvidenceItem` existente. Documentado aquí para que no sea una sorpresa si ocurre.

## BAOS Architecture Alignment

Ninguna de las cuatro decisiones rediseña un Core Component: todas resuelven detalles de materialización dentro del Evidence Graph ya diseñado, alineadas con Phase 1 Foundation. La decisión de scope (#2) reutiliza el patrón de aislamiento ya aceptado en ADR-002 en lugar de crear uno nuevo.

## Related ADRs

- ADR-001: PostgreSQL + Prisma como Canonical Data Model — el Evidence Graph se construye sobre esta base.
- ADR-002: `tenant_id`/aislamiento por columna discriminadora — la decisión #2 de este ADR reutiliza ese mismo patrón vía `projectId`.
