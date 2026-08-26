# ADR-015: La guarda de la cita de conclusión es aproximada mientras la cita no tenga requisito

## Status

Accepted

## Date

2026-08-26

## Context

ADR-010 dejó anotado un riesgo con nombre propio:

> «Un vínculo declarado y no validado no debe poder citarse como evidencia validada en un informe. El riesgo es que el estado nuevo se añada al schema y no se compruebe en el servicio.»

Al ir a implementar esa comprobación aparece un problema que ADR-010 no anticipó: **`EvidenceReportLink` no tiene dimensión de requisito**. Vincula un `EvidenceItem` con un `AuditReport`, y el informe es de proyecto. En el instante en que se cita la evidencia no hay ningún requisito en juego, así que la frase «ese vínculo no puede citarse» no tiene dónde agarrarse en su forma literal.

El sitio donde la comprobación sería exacta es el hallazgo: ADR-011 fija que la unidad de análisis es **un requisito con sus documentos → un hallazgo**. Ahí sí hay requisito, evidencia y conclusión en la misma frase. Pero esas entidades (`AiInference`, `AnalysisRun`) no existen todavía y llegan con el componente de IA completo.

La alternativa a decidir algo era dejar el riesgo declarado y sin mitigar durante todo el desarrollo del componente de IA, que es el periodo más largo del plan.

Hay un segundo hallazgo, este del propio código. La primera versión de la guarda bloqueaba también la evidencia **sin ningún vínculo de requisito**. Un test preexistente (HP-09) la citaba como `conclusion_basis` y empezó a fallar. Al revisarlo: ADR-010 prohíbe citar *un vínculo declarado y no validado*, no prohíbe citar evidencia que no tiene vínculo ninguno. Eso último era legal antes de ADR-010, y prohibirlo es una regla nueva que ningún ADR autoriza.

## BAOS Principles Affected

- **Evidence-first** — es exactamente el punto: una conclusión no debe apoyarse en una asociación documento–requisito que nadie con autoridad ha avalado.
- **Human-in-the-loop** — la guarda existe para que la afirmación del aportante no pase por juicio del auditor sin que un auditor haya intervenido.
- **Governance-first** — se registra tanto lo que la guarda cubre como lo que deja fuera, para que el hueco sea una decisión y no un descuido.
- **Certification-ready** — un auditor externo debe poder ver qué garantizaba el sistema en cada momento; una guarda parcial no documentada sería peor que no tenerla.

## Decision

### D1 — Se aplica ya una guarda gruesa, en el sitio que ADR-010 señaló

En `addEvidenceReportLink`, dentro de la transacción `Serializable` que ya usan las demás invariantes: si `usedAs = 'conclusion_basis'` y la evidencia tiene vínculos de requisito **y ninguno está validado**, la operación devuelve 409.

Gruesa quiere decir que comprueba que **exista** aval de auditor, no que el aval sea **del requisito concreto**. Es todo lo que la forma del dato permite hoy.

Va dentro de la transacción por lo mismo que las demás: entre el recuento y la escritura, otro admin puede retirar el vínculo que daba el aval.

### D2 — La guarda no alcanza a la evidencia sin ningún vínculo de requisito

La condición es `vinculos > 0 && avalados === 0`, no `avalados === 0`. La evidencia que no tiene vínculo alguno puede seguir siendo base de conclusión, como antes de ADR-010.

**Esto es un hueco conocido y aceptado, no un olvido.** Cerrarlo —exigir al menos un vínculo validado para cualquier cita de conclusión— es defendible y probablemente correcto, pero es una regla nueva sobre el ciclo de vida de la evidencia y merece su propia decisión, no colarse dentro de la implementación de otra.

La condición `vinculos > 0` lleva un comentario en el código explicando por qué no es redundante, precisamente para que nadie la elimine creyendo que simplifica.

### D3 — Condición de salida: cuándo se sustituye por la comprobación exacta

Cuando exista el hallazgo por requisito (ADR-011), la comprobación exacta —*este* requisito tiene *este* vínculo validado— vive ahí.

Llegado ese momento, **esta guarda no se retira**: se queda como red de seguridad en el borde del informe. Cubren cosas distintas —una la conclusión por requisito, otra la cita en el informe— y la barata no estorba a la cara.

## Alternatives Considered

### Aplazar toda la comprobación hasta que exista el hallazgo por requisito

Sería la versión exacta y sin aproximaciones. Se descarta por calendario: deja el riesgo que ADR-010 declaró abierto durante todo el desarrollo del componente de IA, que es el tramo más largo del plan y justamente aquel en el que se empezarán a generar conclusiones.

### Añadir la dimensión de requisito a `EvidenceReportLink`

Haría exacta la guarda hoy mismo. Se descarta porque cambia el significado de una entidad del Evidence Graph para resolver un problema de otro componente, y porque duplicaría la asociación documento–requisito que ya vive en `EvidenceRequirementLink`. Dos sitios donde consta lo mismo es el camino corto a que discrepen.

### Bloquear también la evidencia sin vínculo de requisito

Es la guarda que se escribió primero, y HP-09 la tumbó. Se descarta **en este ADR** por alcance: prohíbe algo que ningún ADR prohíbe y que era legal antes. Queda como decisión abierta (ver D2), no como alternativa rechazada por el fondo.

## Consequences

### Positive

- El riesgo que ADR-010 declaró queda mitigado desde hoy, no dentro de varias fases.
- La comprobación vive donde ADR-010 dijo que viviera, con las demás invariantes y con su misma semántica transaccional.
- El coste es un recuento por cita de conclusión: despreciable.
- Lo que la guarda **no** cubre queda escrito en el contrato de API y en el código, no solo en la cabeza de quien lo implementó.

### Negative

- Hay dos comprobaciones donde conceptualmente hay una, hasta que llegue el hallazgo por requisito.
- La guarda puede dar un falso negativo: evidencia con un vínculo validado para el requisito A puede citarse como base de una conclusión sobre el requisito B. Es el precio exacto de no tener requisito en la cita.
- Aparece un paso humano nuevo que hoy no tiene interfaz: para que la evidencia declarada por el dueño pueda sustentar una conclusión, un auditor debe crear el vínculo desde la ruta admin. **No hay UI para ese gesto.**

### Risks

- **Que la aproximación se dé por definitiva.** Si nadie retoma D3, el sistema se queda con la guarda gruesa para siempre y con el falso negativo descrito. Mitigación parcial: la condición de salida está escrita aquí y referenciada desde el contrato de API.
- **Que el hueco de D2 se lea como bug.** Alguien verá que se puede citar evidencia sin vínculo y lo "arreglará" sin saber que era deliberado. Mitigación: comentario en el código y aviso en el contrato.
- **Que el paso admin sin interfaz bloquee el flujo real.** Cuando exista UI de carga, la evidencia declarada no podrá sustentar conclusiones hasta que alguien construya también la pantalla de validación del vínculo. Conviene planificarlas juntas.

## BAOS Architecture Alignment

Compatible con la arquitectura congelada. Toca el **Evidence Graph** y lo implementa sin rediseñarlo: no se añade ni se modifica ninguna entidad, no se elimina ningún punto de control humano, y la trazabilidad aumenta porque una conclusión pasa a exigir intervención de auditor donde antes no la exigía.

No introduce aprendizaje autónomo ni sustituye ningún Core Component. La comprobación exacta que llegará con ADR-011 **absorbe** esta, no la contradice.

## Related ADRs

- **ADR-010** — El vínculo evidencia–requisito lo declara el dueño y lo valida el auditor: este ADR implementa el riesgo que aquel declaró, y explica por qué no puede implementarse tal como está redactado
- **ADR-011** — La unidad de análisis es un requisito con sus documentos: es donde vivirá la comprobación exacta (D3)
- **ADR-003** — Evidence Graph Phase 1 Scoping: define `EvidenceReportLink` sin dimensión de requisito, que es la causa de que la guarda sea aproximada
- **ADR-004** — Evidence Graph Implementation Decisions: fija las invariantes y el patrón transaccional que esta guarda reutiliza
