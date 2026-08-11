# ADR-010: El vínculo evidencia–requisito lo declara el dueño del proyecto y lo valida el auditor

## Status

Accepted

## Date

2026-08-11

## Context

La Audit Intelligence Platform (ADR-008) necesita saber **qué documento hay que evaluar contra qué requisito**. Sin esa correspondencia, el análisis tendría que enfrentar cada documento a los 38 requisitos del rol, y la inmensa mayoría de esos pares no dicen nada: el acta de lecciones aprendidas no habla de la configuración del CDE. Es la diferencia entre un coste proporcional a lo que hay que comprobar y un coste proporcional al producto cartesiano.

Existían dos vías para obtener esa correspondencia: deducirla con una pasada de clasificación previa (coste y error propios), u obtenerla del usuario. El responsable de producto zanjó la cuestión el 2026-08-11 definiendo además la experiencia de usuario:

> «En cada requerimiento debe haber un botón de carga de documentos, que permita asociar directamente el documento cargado con el requerimiento. Si el usuario carga un documento erróneo, la valoración de la auditoría será de NO CONFORMIDAD pero el error es de su responsabilidad.»

**El problema es que esa interacción choca con una decisión ya en vigor.** El vínculo se materializa como `EvidenceRequirementLink`, y su creación vive hoy en `POST /api/admin/evidence/[evidenceId]/requirement-links`. Por ADR-004 #2, el prefijo `/api/admin/` significa **admin-only sin excepciones**, y el security spec del Evidence Graph reserva a admin «solo las acciones que comprometen la integridad certificable». Tal como está, el dueño de un proyecto puede subir su documentación pero **no puede decir para qué la presenta**, que es justo lo que el botón exige.

Abrir sin más `requirement-links` al dueño del proyecto sería repetir el defecto que ADR-004 corrigió: una puerta trasera al control de admin.

## BAOS Principles Affected

- **Evidence-first** — el vínculo es lo que conecta un documento con el requisito sobre el que se concluye. Debe existir antes de cualquier conclusión, y debe constar quién lo afirmó.
- **Human-in-the-loop** — la autoridad final sobre qué evidencia sustenta un requisito sigue siendo del auditor; el dueño del proyecto aporta, no certifica.
- **Governance-first** — declarar y validar son actos distintos, de actores distintos, y ambos quedan registrados con autor y fecha.
- **Security by design** — se conserva el límite de RBAC que ADR-004 estableció, acotándolo en vez de perforándolo.

## Decision

**Se separa el vínculo *declarado* del vínculo *validado*.**

1. **Declarar es del dueño del proyecto.** Sube un documento desde un requisito concreto y, en el mismo gesto, queda creado el `EvidenceItem` y su `EvidenceRequirementLink` hacia ese requisito. Semánticamente es *«presento este papel como evidencia de este requisito»*: una aportación, no una certificación.

2. **Validar sigue siendo del auditor.** Confirmar que ese documento efectivamente sustenta ese requisito es un acto de integridad certificable y se queda donde está, en el ámbito admin, junto a `EvidenceValidation`.

3. **ADR-004 #2 queda acotado, no derogado.** El prefijo `/api/admin/` sigue significando admin-only sin excepciones. Lo que cambia es que la **declaración** del vínculo deja de vivir bajo ese prefijo y pasa a una ruta del dueño del proyecto, colgando del requisito. La **validación** permanece bajo `/api/admin/`.

El criterio que separa ambos actos, y que debe aplicarse a cualquier caso futuro: *¿este acto afirma un hecho sobre la intención del aportante, o emite un juicio sobre el cumplimiento?* Lo primero es del dueño; lo segundo, del auditor.

**Consecuencia explícita y aceptada**: si el usuario cuelga un documento equivocado, la responsabilidad es suya y el resultado es una no conformidad. El sistema no busca el documento correcto ni corrige la declaración del usuario. Esto no exige código nuevo: el diseño ya obliga a que la conformidad venga acompañada de cita literal del documento (ADR-008 D3), y un documento que no habla del requisito no ofrece nada que citar.

## Alternatives Considered

### Mantener el vínculo como admin-only

Deja el producto inservible para su usuario natural. El dueño del proyecto es quien conoce su documentación y quien la aporta; obligar a que un administrador clasifique cada fichero convierte la carga de evidencias en un cuello de botella manual y hace imposible el botón por requisito. Descartada por producto, no por arquitectura.

### Abrir `requirement-links` al dueño del proyecto sin distinción

Sería la vía rápida, y borra el límite que ADR-004 estableció: un vínculo creado por el dueño y uno confirmado por el auditor pasarían a ser indistinguibles en la base. Un informe certificable no podría después demostrar quién afirmó qué. Descartada por gobernanza.

### Deducir el vínculo con una pasada de clasificación por IA

Era la alternativa si el usuario no declarase. Cuesta dinero (una lectura completa del corpus, ~$5 por cada mil páginas incluso con un modelo barato), introduce una fuente de error nueva y desplaza al humano de una decisión que él conoce mejor. Innecesaria desde el momento en que la interfaz pide el vínculo al usuario.

## Consequences

### Positive

- El rutado del análisis sale **gratis y exacto**: solo se analizan los pares documento–requisito que el usuario declaró.
- El coste del componente de IA pasa a ser proporcional a la documentación realmente aportada, no al número de requisitos del rol.
- La experiencia mejora: subir evidencia deja de ser una tarea de archivo separada y pasa a estar donde el usuario está trabajando.
- La responsabilidad queda repartida con claridad, y el propio diseño la hace cumplir sin reglas añadidas.

### Negative

- **Requiere migración.** `EvidenceRequirementLink` solo tiene hoy `linkType` y `addedBy`; no distingue declarado de validado. Hay que añadir el estado de validación (autor y fecha, anulables). Es puramente aditivo.
- El contrato de API y el security spec del Evidence Graph cambian: aparece una ruta de creación fuera de `/api/admin/` y la matriz RBAC deja de ser «todo vínculo es admin».
- El test plan del Evidence Graph tiene casos que asumen que crear un vínculo requiere admin; hay que revisarlos, no solo añadir.

### Risks

- **Un vínculo declarado y no validado no debe poder citarse como evidencia validada en un informe.** El riesgo es que el estado nuevo se añada al schema y no se compruebe en el servicio. Mitigación: la comprobación va en `services/evidence.service.ts`, junto a las demás invariantes, y dentro de la transacción `Serializable` que ya usan los checks leer-luego-escribir.
- El usuario puede colgar el mismo documento en muchos requisitos. No es un error —el BEP es evidencia de una docena de requisitos— pero multiplica el coste de análisis. Mitigación en ADR-011: ordenar el análisis por documento y apoyarse en la caché de prompt.

## BAOS Architecture Alignment

Compatible con la arquitectura congelada. Toca el **Evidence Graph**, y lo implementa sin rediseñarlo: no se añade ninguna entidad, no se elimina ningún punto de control humano y la trazabilidad crece en vez de reducirse, porque a partir de ahora consta tanto quién declaró el vínculo como quién lo validó.

El punto de control humano no se elimina: se desdobla. Antes había un único acto admin que mezclaba aportación y juicio; ahora hay dos actos con dos actores y dos registros. La autoridad final sobre el cumplimiento sigue siendo íntegramente del auditor.

## Related ADRs

- ADR-004: Evidence Graph Implementation Decisions — acota su punto #2 (`/api/admin/` = admin-only sin excepciones), sin derogarlo
- ADR-003: Evidence Graph Phase 1 Scoping — define `EvidenceRequirementLink` y el alcance por `projectId`
- ADR-008: Audit Intelligence Platform — es quien consume este vínculo como tabla de rutas del análisis
- ADR-011: Unidad de análisis y troceado de peticiones — desarrolla las consecuencias de coste de esta decisión
