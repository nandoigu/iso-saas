# ADR-006: El snapshot de versión describe el estado resultante, no el previo

## Status

Accepted

## Date

2026-08-08

## Context

BAOS versiona dos entidades con el mismo patrón de gobernanza: `AuditReport` / `AuditReportVersion` y `EvidenceItem` / `EvidenceItemVersion`. En ambos casos, una mutación de contenido incrementa el número de versión de la entidad y escribe una fila de snapshot.

Lo que nunca se dejó escrito es **qué estado contiene ese snapshot**: el anterior a la mutación o el resultante de ella. La ambigüedad salió a la luz al escribir los tests de la Fase E del Evidence Graph (2026-08-08): el test-plan de `docs/test-plans/evidence-graph.md`, redactado el 2026-07-01 antes de existir la implementación, preveía en su caso VER-02 que «el snapshot de la versión contiene el estado previo completo (no el nuevo)», mientras que el código implementado en la Fase B hace exactamente lo contrario, de forma deliberada y comentada (`services/evidence.service.ts:151`).

Sin una regla explícita, cualquier componente futuro que versione — Requirement Graph, Knowledge Graph, Audit Runtime — puede elegir el criterio opuesto, y el historial del sistema dejaría de ser interpretable de manera uniforme. Para un sistema cuyo producto final es la reconstrucción de una auditoría, un historial que se lee al revés según el módulo es un defecto de gobernanza, no un detalle de implementación.

## BAOS Principles Affected

- **Governance-first** — el versionado es el mecanismo de gobernanza del cambio. Su semántica debe ser única y explícita en todo el sistema; dos módulos con criterios opuestos hacen el historial ambiguo.
- **Explainability-first** — reconstruir una conclusión exige saber sin ambigüedad qué estado tenía cada entidad en cada versión citada. Si el snapshot N puede significar «estado en N» o «estado antes de N» según el módulo, la reconstrucción deja de ser determinista.
- **Certification-ready** — un auditor externo que examine el historial debe poder leerlo con una sola regla, sin conocer qué módulo escribió cada fila.

## Decision

**El snapshot de la versión N contiene el estado de la entidad tal como queda en la versión N.** El snapshot se escribe después de aplicar la mutación, dentro de la misma transacción, y refleja el resultado.

Corolarios de obligado cumplimiento para cualquier entidad versionada de BAOS:

1. **La creación genera la versión 1.** Una entidad recién creada ya tiene su fila de snapshot. Sin esto, la primera edición no tendría estado anterior registrado y el historial empezaría incompleto.
2. **`Entidad.version` es siempre igual al mayor `EntidadVersion.version`.** Esta es la invariante #5 del domain model del Evidence Graph, y solo se sostiene con la semántica «estado resultante».
3. **El estado previo a cualquier edición se lee en la fila anterior.** No se pierde información: el historial completo sigue siendo reconstruible, simplemente se lee hacia atrás desde la versión actual.
4. **Snapshot y mutación viajan en la misma transacción.** Un snapshot sin su mutación, o al revés, deja el historial mintiendo.

Justificación técnica: esta es ya la semántica implementada en los dos módulos que versionan hoy, de forma independiente y coincidente. `AuditReport` actualiza a `nextVersion` con el contenido nuevo y acto seguido llama a `createVersion` con ese mismo contenido (`services/audit-report.service.ts:122-148`). El Evidence Graph hace lo propio (`services/evidence.service.ts:176-195`). Además, el comentario del schema lo dice desde el principio: `snapshot Json // full EvidenceItem state at this version` (`prisma/schema.prisma:171`) — «at this version», no «antes de esta versión». La decisión formaliza lo que el sistema ya hace de manera consistente; no cambia una sola línea de código.

## Alternatives Considered

### Snapshot del estado previo

Es lo que preveía el caso VER-02 del test-plan. Tiene un atractivo aparente: la fila de versión funcionaría como un «undo» directo, con el estado al que volver ya materializado.

Se descarta por tres razones. Primera, rompe la invariante #5: la versión N contendría el estado de la N-1, y el estado actual de la entidad no existiría en ninguna fila hasta que llegara la siguiente edición — el historial iría siempre un paso por detrás de la realidad. Segunda, obligaría a cambiar `AuditReport`, que lleva en producción desde antes del Evidence Graph, con migración de datos de los snapshots ya escritos. Tercera, el «undo» que promete se obtiene igual leyendo la fila anterior, que es una consulta trivial dado el índice `@@unique([evidenceItemId, version])`.

### Guardar ambos estados en cada fila (`before` / `after`)

Elimina toda ambigüedad por construcción y facilita mostrar diffs.

Se descarta por coste desproporcionado en Phase 1: duplica el almacenamiento de un campo JSON que puede ser voluminoso, y esa duplicación es exactamente la que ADR-005 intenta controlar con el ciclo de purga por retención. El estado previo ya es recuperable de la fila anterior, así que se estaría pagando espacio por información redundante. Queda como opción reconsiderable si algún día se necesita renderizar diffs a gran escala.

## Consequences

### Positive

- Una sola regla de lectura del historial para todo BAOS, verificable por un auditor externo sin conocer el módulo de origen.
- La invariante #5 del Evidence Graph queda respaldada por una decisión explícita, no por una coincidencia de implementación.
- Cero cambios de código: los dos módulos que versionan hoy ya cumplen. Coste de adopción nulo.
- Los componentes que versionen en el futuro tienen la regla escrita antes de implementarse.

### Negative

- Obtener el estado previo a una edición exige una consulta extra a la fila `version - 1`. Es un coste real, aunque mínimo dado el índice único sobre `(entidadId, version)`.
- El caso VER-02 del test-plan del Evidence Graph queda inválido y hay que corregirlo. Se corrige en el mismo cambio que introduce este ADR.

### Risks

- **Un componente futuro versiona al revés por desconocimiento.** Mitigación: este ADR es la referencia, y la skill `domain-model` debe consultarlo al diseñar cualquier entidad versionada. El síntoma detectable es que `Entidad.version` deje de coincidir con el máximo de su tabla de versiones — un test de invariante barato que conviene replicar en cada componente que versione.
- **Los tests podrían fijar el comportamiento equivocado si se escribieran desde el test-plan sin leer el código.** Ya ocurrió parcialmente en esta sesión y se detectó al contrastar con el schema y con `AuditReport`. Mitigación: ante una discrepancia plan/código en materia de gobernanza, la autoridad es el domain model y el precedente implementado, no el test-plan.

## BAOS Architecture Alignment

Compatible con la arquitectura congelada. No toca ningún Core Component: fija la semántica de un mecanismo transversal de gobernanza que esos componentes ya usan. No introduce aprendizaje autónomo, no elimina ningún punto de control humano, no altera el aislamiento multi-tenant y no reduce la trazabilidad de la evidencia — al contrario, la hace inequívoca al eliminar una ambigüedad de lectura del historial.

En términos del Explainability Framework, esta decisión es un prerrequisito: la reconstrucción completa de una conclusión exige que el estado de cada entidad en cada versión citada sea determinista.

## Related ADRs

- ADR-003: Evidence Graph Phase 1 Scoping Decisions — define el alcance dentro del cual se implementó el versionado de `EvidenceItem`.
- ADR-004: Evidence Graph Implementation Decisions — fija el ciclo de vida cuyas transiciones de contenido disparan la creación de versiones.
- ADR-005: Ciclo de cierre de auditoría — la purga por retención opera sobre estas filas de snapshot; la semántica que aquí se fija determina qué se pierde al purgar una versión concreta.
