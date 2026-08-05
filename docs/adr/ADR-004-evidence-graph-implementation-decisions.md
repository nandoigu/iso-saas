# ADR-004: Evidence Graph Implementation Decisions — Lifecycle, Route Convention and Binary Upload

## Status

Accepted

## Date

2026-08-05

## Context

ADR-003 fijó el alcance conceptual del Evidence Graph para Phase 1 y el pipeline de gobernanza se completó el 2026-07-01 (component spec, domain model, API contract, security spec, test plan). Al releer esos documentos antes de escribir código aparecieron tres huecos que impiden implementar sin decidir primero. Ninguno es un rediseño: son detalles de materialización que el contrato dejó abiertos o resolvió de forma incoherente consigo mismo.

**1. El estado `submitted` es inalcanzable.** El ciclo de vida de `EvidenceItem` define seis estados (`draft`, `submitted`, `under_review`, `validated`, `rejected`, `archived`), pero ninguna operación del contrato lleva de `draft` a `submitted`: `POST .../evidence` crea siempre en `draft`, `PATCH` solo contempla la transición `rejected → submitted` como efecto lateral, y `POST .../validate` produce `validated`, `rejected` o `under_review`. Una evidencia recién creada no tiene forma de declararse lista para revisión.

**2. El prefijo `/api/admin/` no es fiable como garantía de rol.** El contrato sitúa `GET /api/admin/evidence/[evidenceId]/file` bajo el prefijo de administración pero lo abre al dueño del proyecto, y a la vez deja `POST|DELETE /api/evidence/[evidenceId]/requirement-links` fuera de ese prefijo siendo `admin only`. Es decir, los dos casos están exactamente invertidos. El security spec arrastra la misma contradicción: su matriz RBAC concede la signed URL al dueño del proyecto, mientras su texto introductorio la lista entre las acciones que exigen `admin`.

**3. La subida del binario no está definida.** El contrato persiste `sourceRef` (un `pathname` de Vercel Blob) y sirve el acceso de lectura vía signed URL, pero deja explícitamente abierto cómo llega el archivo al store. Sin esa pieza, una evidencia de tipo `document` no tiene documento. El proyecto despliega en funciones serverless de Vercel, cuyo body de petición está limitado a ~4,5 MB, y los archivos esperados en una auditoría ISO 19650 son planos BIM, informes y procedimientos firmados que superan ese umbral con normalidad.

## BAOS Principles Affected

- **Evidence-first** — el hueco #3 es bloqueante para el principio: sin un camino de subida no hay binario que respalde la evidencia registrada, y una `EvidenceItem` sin documento es una afirmación, no una evidencia.
- **Human-in-the-loop** — el hueco #1 elimina de facto el momento en que el dueño del proyecto declara una evidencia lista para revisión, dejando al admin sin señal de qué revisar.
- **Security by design** — el hueco #2 degrada el prefijo `/api/admin/` de garantía estructural a mera convención de nombres, obligando a auditar caso por caso qué protege realmente cada ruta.
- **Governance-first** — las tres decisiones alteran el contrato de API ya documentado; quedan registradas aquí para que el contrato actualizado tenga justificación trazable.

## Decision

### Decisión 1 — Añadir `POST /api/evidence/[evidenceId]/submit`

Se añade un endpoint que transiciona `draft → submitted`, ejecutable por el dueño del proyecto (y por `admin`). El estado `submitted` se mantiene en el ciclo de vida y pasa a ser alcanzable.

Justificación: `submitted` no es decorativo, marca el punto exacto en que la responsabilidad pasa del auditado al auditor. Es la señal que permite al admin saber qué cola tiene pendiente sin inspeccionar borradores ajenos, y deja en el trail quién y cuándo dio una evidencia por completa. Eliminar el estado habría simplificado el código a costa de fundir dos actos distintos —redactar y presentar— en uno solo, que es precisamente el tipo de simplificación que la arquitectura FROZEN prohíbe.

Esta decisión suma un endpoint al contrato (la decisión 3 añade otro; el total del componente pasa de 10 a 12).

### Decisión 2 — `/api/admin/*` significa `admin only`, sin excepciones

Se realinean las dos rutas incoherentes:

| Antes | Después | RBAC |
|-------|---------|------|
| `GET /api/admin/evidence/[evidenceId]/file` | `GET /api/evidence/[evidenceId]/file` | dueño + admin |
| `POST /api/evidence/[evidenceId]/requirement-links` | `POST /api/admin/evidence/[evidenceId]/requirement-links` | admin only |
| `DELETE /api/evidence/[evidenceId]/requirement-links/[linkId]` | `DELETE /api/admin/evidence/[evidenceId]/requirement-links/[linkId]` | admin only |

La regla queda enunciada para todo el proyecto: si una ruta cuelga de `/api/admin/`, exige `role === 'admin'`; si no cuelga, no lo exige. El RBAC se sigue aplicando en el handler —el prefijo no es el mecanismo de control— pero deja de haber divergencia entre lo que la ruta promete y lo que hace.

La contradicción del security spec se resuelve a favor de su matriz RBAC: la signed URL es accesible al dueño del proyecto. Un dueño que no pudiera abrir su propio documento subido no tendría forma de verificar qué presentó.

### Decisión 3 — Client upload con token firmado emitido por el servidor

El binario se sube desde el cliente directamente al store de Vercel Blob, usando el flujo de client upload de `@vercel/blob/client`. Una ruta server-side emite el token de subida y es donde se aplican sesión, RBAC y verificación de tenant antes de autorizar nada. El cliente recibe después el `pathname` resultante y lo envía a `POST .../evidence` o `PATCH .../evidence/[id]` como `sourceRef`, tal y como el contrato ya preveía.

Justificación: el límite de ~4,5 MB del body en funciones serverless de Vercel es incompatible con los archivos reales de una auditoría ISO 19650. Hacer que el binario atraviese la función no aporta control adicional —la autorización ocurre igualmente en el servidor, al emitir el token— y sí introduce un techo de tamaño arbitrario que dejaría fuera justo las evidencias más relevantes.

La superficie exacta de la API de `@vercel/blob` se verificará contra su documentación durante la implementación; esta decisión fija el patrón, no las firmas.

La ruta emisora del token es un endpoint nuevo del contrato: `POST /api/projects/[projectId]/evidence/upload-token`. Cuelga de `/api/projects/[projectId]/` porque la autorización que aplica es exactamente la del proyecto —dueño o admin—, la misma que `POST .../evidence`.

## Alternatives Considered

### Decisión 1 — Eliminar `submitted` del enum de estados

El ciclo quedaría `draft → (validate) → validated | rejected | under_review`, con menos código y menos superficie de API. Descartada porque obliga a modificar domain model, contrato y test plan para quitar un estado que sí tiene significado de negocio, y deja al admin sin forma de distinguir un borrador a medias de una evidencia presentada. La ganancia era un endpoint menos; el coste, perder el acto de presentación.

### Decisión 2 — Dejar las rutas como estaban y aplicar el RBAC solo en el handler

Cero cambios en documentación y funcionalmente equivalente, porque el control real siempre estuvo en el handler. Descartada porque convierte cada revisión de seguridad futura en una inspección ruta por ruta: nadie puede volver a asumir que `/api/admin/` implica `admin`, y la excepción actual pasaría a ser precedente para la siguiente.

### Decisión 3 — Ruta server-side que recibe el fichero y lo sube al store

Un único punto de control para tenant y RBAC, más fácil de testear sin mocks de cliente. Descartada por el límite de ~4,5 MB del body de la función: los planos BIM y los informes de proyecto lo superan de forma rutinaria, y un componente cuyo propósito es custodiar evidencia no puede rechazar la evidencia por tamaño.

## Consequences

### Positive
- El ciclo de vida de `EvidenceItem` queda completo y recorrible: todos los estados declarados son alcanzables.
- `/api/admin/` recupera valor como invariante estructural verificable de un vistazo, en este componente y en los siguientes.
- El tamaño del archivo deja de ser una restricción del sistema, que es condición necesaria para que el Evidence Graph sirva a auditorías reales.
- La contradicción interna del security spec queda cerrada en una dirección explícita y razonada.

### Negative
- Un endpoint más que implementar, documentar y testear (11 en lugar de 10).
- El api-contract y el security spec, ya escritos, deben actualizarse antes de implementar; el test plan hereda un caso nuevo para la transición `draft → submitted`.
- El client upload reparte el flujo entre cliente y servidor: el testing de integración cubre la emisión del token, y la subida real del binario queda como verificación manual, tal como ya preveía el test plan.

### Risks
- **Archivos huérfanos en el store**: con client upload, el binario puede quedar subido sin que llegue a crearse la `EvidenceItem` (el usuario abandona el formulario). Mitigación: la ruta emisora del token escribe bajo un prefijo con el `projectId`, de modo que los huérfanos son identificables y limpiables; se documenta como tarea operativa, no se resuelve en Phase 1. El riesgo inverso —perder evidencia— no existe: el binario se sube antes que el registro, nunca después.
- **La ruta emisora del token es el nuevo punto crítico de seguridad**: si no verifica sesión, rol y pertenencia del proyecto antes de firmar, concede escritura en el store a cualquiera. Mitigación: se trata como endpoint de escritura de pleno derecho en el security spec y recibe sus propios tests de aislamiento de tenant.
- **Sin rate limiting** (heredado de la open question #2 del security spec): la emisión de tokens de subida comparte el riesgo ya aceptado para la generación de signed URLs. No es fuga cross-tenant, solo coste operativo.

## BAOS Architecture Alignment

Compatible con la arquitectura FROZEN. Las tres decisiones **implementan** el Core Component *Evidence Graph* sin rediseñarlo: no alteran el modelo conceptual, no introducen aprendizaje autónomo, no eliminan ningún mecanismo de gobernanza y no sustituyen supervisión humana por automatismo.

La decisión 1 **refuerza** human-in-the-loop al restituir el acto explícito de presentación por parte del auditado. La decisión 2 **refuerza** security by design sin cambiar el modelo RBAC ya aprobado en el security spec —solo hace que la estructura de rutas lo refleje. La decisión 3 materializa la decisión #1 de ADR-003 (Vercel Blob como storage con acceso por signed URL) eligiendo el mecanismo de escritura que ADR-003 dejó fuera de alcance; la lectura sigue exactamente como allí se decidió.

Ninguna decisión toca el aislamiento multi-tenant definido en ADR-002 ni el modelo canónico de ADR-001.

## Related ADRs

- ADR-003: Evidence Graph Phase 1 Scoping Decisions — fija Vercel Blob como storage y el acceso vía signed URL; este ADR completa el camino de escritura que aquel dejó abierto, y resuelve la open question #1 de su api-contract.
- ADR-002: Use tenant_id Column for Multi-Tenant Isolation in Prisma — la ruta emisora del token de subida debe aplicar el mismo patrón de aislamiento por proyecto.
- ADR-001: Use PostgreSQL with Prisma for the BAOS Canonical Data Model — sin impacto; el binario vive fuera de Neon, solo la referencia se persiste.
