# ADR-005: Ciclo de cierre de auditoría — exportar, purgar y liberar espacio

## Status

Accepted

## Date

2026-08-06

## Context

El sistema no tiene hoy ninguna forma de dar por terminada una auditoría. Un proyecto, sus requisitos, sus evidencias y sus informes se acumulan indefinidamente, y no existe ni un camino para que el cliente recupere su documentación al acabar, ni uno para retirarla del sistema.

Esto produce tres problemas simultáneos:

1. **El almacenamiento crece sin techo.** Las evidencias de una auditoría ISO 19650 son planos BIM, informes y procedimientos firmados. Sin retirada, el coste crece de forma monótona con cada auditoría realizada, aunque hayan terminado hace años.
2. **El cliente no puede recuperar lo suyo.** Toda su documentación de auditoría vive dentro de la plataforma y no hay un acto de entrega. Terminar una auditoría no le devuelve nada.
3. **El cliente no puede retirar lo suyo.** Sin purga no hay respuesta posible a una petición de supresión de datos.

La dificultad no es técnica sino de gobernanza: el Evidence Graph está diseñado para que la evidencia sea **inmutable**. `EvidenceItem.project` es `onDelete: Restrict` y la invariante #3 de su domain model impide borrar una evidencia citada en un informe. Ambas cosas son deliberadas y derivan de *evidence-first*. Es decir, **el sistema prohíbe hoy exactamente lo que este ADR necesita permitir**.

La pregunta que fuerza la decisión es por tanto: si la evidencia es inmutable y trazable, ¿qué puede significar "borrar" una auditoría cerrada sin destruir el principio que sostiene el producto?

Restricción adicional: no se conoce todavía si existe un plazo mínimo de conservación exigible por un organismo certificador o por la normativa mercantil aplicable. El diseño no puede quedar bloqueado esperando esa respuesta, pero tampoco puede ignorarla.

## BAOS Principles Affected

- **Evidence-first** — es el principio en tensión directa. La purga elimina la evidencia; la decisión debe conservar la capacidad de acreditar que existió y que lo entregado es íntegro, o el principio queda vacío.
- **Governance-first** — la purga es la operación más destructiva del sistema. Debe ser un acto gobernado, versionado y atribuible, no un borrado ordinario.
- **Certification-ready** — un certificador que audite la plataforma preguntará qué ocurrió con las auditorías que ya no están. Sin respuesta acreditable, la arquitectura no soporta certificación.
- **Human-in-the-loop** — la purga no puede desencadenarse por automatismo, caducidad ni limpieza programada. Requiere un acto humano explícito.
- **Security by design** — quién puede purgar es una decisión de privilegio: el auditado no puede poder destruir la auditoría que se le practicó.

## Decision

Se introduce un **ciclo de cierre de auditoría** en tres actos, en este orden y sin poder saltarse ninguno: **exportar → purgar → liberar**.

### 1. Exportar

Se genera un **paquete de cierre** que contiene la auditoría completa: proyecto, requisitos, evidencias con sus binarios, validaciones, vínculos, versiones e informes. El paquete es la entrega al cliente y, tras la purga, **el único lugar donde esa auditoría existe**.

El paquete se **sella con un hash** de su contenido. Ese hash es lo que permite demostrar años después que lo que el cliente conserva es exactamente lo que el sistema entregó, sin alteraciones.

### 2. Purgar — con recibo sellado

Se eliminan las evidencias, los binarios del store y el contenido de la auditoría. **Queda un recibo inmutable** con el mínimo imprescindible para acreditar el hecho: identificador de la auditoría, fechas de realización y de cierre, quién ejecutó la purga, cuándo, y el hash del paquete exportado.

El recibo es la pieza que reconcilia la purga con *evidence-first*. La evidencia deja de estar, pero **no desaparece la prueba de que estuvo**, ni la capacidad de verificar la integridad de lo entregado. El coste en espacio es despreciable: unos bytes por auditoría frente a los gigabytes que libera.

### 3. Liberar

El espacio queda efectivamente disponible, tanto en base de datos como en el store de binarios.

### Reglas de gobierno

| Regla | Valor | Motivo |
|-------|-------|--------|
| Quién puede purgar | `admin` únicamente | El auditado no debe poder destruir la auditoría que se le practicó |
| Cuándo se permite | Solo con la auditoría cerrada — informe `signed` o `finalizado` | Purgar una auditoría en curso destruye trabajo vivo, no archivo |
| Plazo mínimo de conservación | **Parametrizable**, por defecto **6 años** desde el cierre | No se conoce todavía la obligación real. El defecto es el plazo mercantil habitual en España, conservador a propósito |
| Exportación previa | Obligatoria. No se purga lo que no se ha exportado y verificado | Sin ella la purga es pérdida, no cierre |

El plazo es configuración, no constante en código: cuando se confirme la obligación real con un organismo certificador o con asesoría, se ajusta sin tocar el diseño.

## Alternatives Considered

### Levantar la restricción de inmutabilidad y permitir el borrado ordinario

Quitar el `onDelete: Restrict` y la invariante #3, y dejar que borrar un proyecto arrastre sus evidencias como cualquier otro dato. Es con diferencia lo más simple: no hace falta paquete, ni hash, ni recibo, ni componente nuevo.

Descartada porque destruye el principio que sostiene el producto. Un sistema de auditoría en el que las evidencias pueden desaparecer sin dejar rastro no es certificable ni defendible ante un tercero, y el argumento comercial de BAOS —trazabilidad completa— dejaría de ser cierto. La arquitectura FROZEN prohíbe expresamente eliminar mecanismos de gobernanza.

### Purga total, sin rastro alguno

Borrar el proyecto y todo lo asociado como si nunca hubiera existido. Es la opción más limpia desde la perspectiva de protección de datos y la más fácil de explicar en una petición de supresión.

Descartada tras plantearla explícitamente al responsable del producto. El sistema perdería la capacidad de acreditar que la auditoría se realizó, y el paquete exportado dejaría de ser verificable: sin el hash conservado, un cliente podría alterar su copia y nadie podría demostrarlo, en ninguna de las dos direcciones. Se prefiere conservar un recibo de unos bytes.

### Archivado en frío en lugar de purga

Mover la auditoría a almacenamiento barato en vez de eliminarla, conservándolo todo. Preserva la trazabilidad íntegra sin decisiones dolorosas.

Descartada porque no resuelve ninguno de los tres problemas del contexto: el coste sigue creciendo de forma monótona, el cliente sigue sin poder retirar sus datos, y añade una capa de infraestructura para posponer la decisión en lugar de tomarla. Puede reconsiderarse más adelante como opción intermedia ofrecida al cliente, no como sustituto del cierre.

## Consequences

### Positive

- El almacenamiento deja de crecer sin techo: se convierte en función de las auditorías **activas**, no de las realizadas históricamente. Esto cambia sustancialmente el dimensionamiento de plan y cupo del store de binarios.
- El cliente recibe una entrega tangible al terminar, con integridad verificable. Es un hito comercial, no solo técnico.
- Existe una respuesta operativa a una petición de supresión de datos.
- *Evidence-first* sobrevive a la purga: lo que se pierde es el contenido, no la acreditación de que existió.

### Negative

- Es un **componente nuevo**, no un retoque: exige el pipeline completo (`component-spec → domain-model → api-contract → security-spec → implementación → migración → test-plan`).
- Obliga a revisar la invariante #3 y el `onDelete: Restrict` del Evidence Graph, que hoy prohíben lo que este ADR permite. La revisión debe articular la excepción **exclusivamente** por la vía del ciclo de cierre, nunca abriendo el borrado ordinario.
- Introduce dependencia de la integridad del paquete exportado: generar el hash, conservarlo y poder verificarlo son ahora responsabilidades del sistema.

### Risks

- **El cliente pierde el paquete.** Tras la purga no hay copia: el paquete es el único ejemplar. Mitigación: la interfaz debe advertirlo de forma inequívoca en el momento de purgar, no en documentación ni en letra pequeña; y la purga debe exigir confirmación explícita de que el paquete se ha descargado y verificado.
- **Purga prematura por desconocer la obligación de conservación.** El plazo por defecto de 6 años es una estimación, no una certeza normativa. Mitigación: es parametrizable y el defecto es conservador; queda como tarea pendiente confirmarlo con un organismo certificador.
- **Exportación parcial silenciosa.** Un paquete al que falte una evidencia, seguido de purga, es pérdida irreversible presentada como cierre correcto. Mitigación: el hash debe cubrir un manifiesto con el recuento de piezas esperadas, y la verificación previa a la purga debe cotejarlo.
- **El recibo como dato personal residual.** Conserva identificadores y fechas tras la purga. Si una petición de supresión exigiera borrar también el recibo, habría conflicto entre el derecho de supresión y la acreditabilidad. No se resuelve aquí; se señala para el security-spec del componente.

## BAOS Architecture Alignment

Compatible con la arquitectura FROZEN, con una salvedad que se explicita.

La decisión **no elimina** ningún mecanismo de gobernanza: sustituye la inmutabilidad absoluta por inmutabilidad con acto de cierre gobernado, atribuible y verificable. No introduce aprendizaje autónomo, no sustituye supervisión humana por automatismo —la purga exige acto humano explícito de un `admin`— y no altera el aislamiento multi-tenant de ADR-002.

**Salvedad explícita**: este ADR requiere modificar una invariante ya aceptada del Evidence Graph (la #3, y el `onDelete: Restrict` de `EvidenceItem.project`). No es un rediseño del Core Component *Evidence Graph* sino la incorporación de un ciclo de vida que su diseño original no contempló, pero **toca gobernanza aprobada** y debe registrarse como tal. La modificación se acotará en el domain model del componente nuevo, no abriendo el borrado ordinario.

El componente resultante no sustituye a ningún Core Component existente. Su relación natural es con *Audit Runtime* (ejecución controlada del proceso de auditoría, del que el cierre es la última fase) y con *Explainability Framework* (el recibo y el hash son lo que mantiene reconstruible una conclusión cuya evidencia ya no está en línea).

## Related ADRs

- **ADR-003**: Evidence Graph Phase 1 Scoping Decisions — fija Vercel Blob como storage. La purga debe liberar también el binario en el store, no solo la fila en base de datos.
- **ADR-004**: Evidence Graph Implementation Decisions — establece que el binario nunca atraviesa la función serverless. La exportación de paquetes grandes deberá respetar la misma restricción de tamaño.
- **ADR-002**: Multi-Tenant Isolation — la exportación y la purga son operaciones cross-entidad sobre un proyecto completo; el aislamiento por tenant debe verificarse en ambas.
