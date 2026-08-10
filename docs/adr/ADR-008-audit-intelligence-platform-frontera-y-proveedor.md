# ADR-008: Frontera del análisis IA y elección de proveedor, modelo y mecánica de citación

## Status

Accepted

## Date

2026-08-10

## Context

BAOS existe para que un sistema lea la documentación real de un proyecto y determine, requisito a requisito, si la ISO 19650 se observa. Hasta hoy la plataforma es un gestor de cumplimiento: el humano declara el estado de cada `Requirement` y la aplicación lo registra, agrega y exporta. No hay una sola línea de IA en el repositorio — ninguna dependencia, ningún proveedor, ninguna clave. El endpoint `generate-requirements`, pese al nombre, copia plantillas por rol.

El component-spec `docs/component-specs/audit-intelligence-platform.md` (2026-08-10) sitúa ese trabajo bajo la **Audit Intelligence Platform**, con la extracción documental incluida y evaluando contra el texto de los `Requirement` existentes. Ese spec deja cinco preguntas abiertas y declara dos de ellas bloqueantes: bajo qué componente cae realmente la evaluación, y cómo se ejecuta un análisis que no cabe en una petición HTTP síncrona.

Además, el spec del Evidence Graph (`docs/component-specs/evidence-graph.md`, línea 72) dice que evaluar si un requisito normativo se cumple «es responsabilidad del futuro Rule Engine». Es gobernanza ya aceptada, escrita cuando el Rule Engine era un nombre sin contenido. Implementar el análisis IA sin resolver esa frase deja dos documentos aprobados en contradicción.

Este ADR cierra cinco decisiones antes de escribir el domain model.

## BAOS Principles Affected

- **Evidence-first** — una conclusión de cumplimiento debe apoyarse en una pieza concreta y verificable del documento, no en una afirmación del modelo sobre el documento. La diferencia entre ambas cosas es la que decide la mecánica de citación.
- **Explainability-first** — toda conclusión asistida por IA debe poder reconstruirse: qué modelo, qué versión, qué prompt, sobre qué entradas y bajo qué configuración. Es la regla de provenance ya fijada en `CLAUDE.md`.
- **Human-in-the-loop** — el modelo propone; el auditor decide. Ninguna salida de IA puede transicionar por sí sola el estado de un requisito.
- **Governance-first** — la frontera entre componentes congelados no puede quedar implícita: dos motores con fiabilidades distintas exigen registros distintos.
- **Multi-tenant isolation** — el contenido extraído y toda inferencia quedan acotados al proyecto, igual que `EvidenceItem`.
- **Certification-ready** — un revisor externo debe poder verificar una cita abriendo el documento por la página indicada.

## Decision

### D1 — El juicio en lenguaje natural es de la Audit Intelligence Platform; el Rule Engine conserva las reglas deterministas

Se delimita, no se reasigna:

| Componente | Qué evalúa | Naturaleza del resultado |
|---|---|---|
| **Rule Engine** (futuro) | Reglas verificables sin juicio: presencia de un documento obligatorio, fechas dentro de plazo, formatos, campos requeridos | Verdadero/falso reproducible |
| **Audit Intelligence Platform** (este) | Si el contenido de un documento satisface lo que un requisito exige | Propuesta razonada, con confianza y citas |
| **Auditor humano** | Ambas | **Veredicto** |

La frase del Evidence Graph se lee, a partir de ahora, referida a la evaluación determinista. Se mantiene sin editar el documento original; este ADR es la referencia que la acota.

Motivo: son dos motores que fallan de forma distinta y se prueban de forma distinta. Una regla determinista se verifica con un test de tabla; un juicio sobre lenguaje natural solo se verifica midiendo el acuerdo con un auditor humano. Fundirlos en un componente haría imposible razonar sobre la fiabilidad de ninguno de los dos, y contaminaría de incertidumbre estadística comprobaciones que hoy son exactas.

### D2 — Proveedor Anthropic, modelo `claude-opus-5`, siempre tras la abstracción `AIProvider`

El dominio **no importa el SDK de ningún proveedor**. Toda inferencia pasa por `AIProvider`, según la regla ya fijada en `CLAUDE.md`. Implementación inicial con `@anthropic-ai/sdk` sobre TypeScript, que es el stack del proyecto.

Modelo por defecto: **`claude-opus-5`** ($5 / $1M tokens de entrada, $25 / $1M de salida; ventana de 1M, salida máxima 128K). El modelo es **parámetro de configuración por operación**, no una constante: la regla de provenance obliga a registrar modelo y versión en cada inferencia, así que cambiarlo es un cambio de configuración auditable, no una migración.

Alternativas de coste verificadas, disponibles sin cambiar código: `claude-sonnet-5` ($3 / $15; $2 / $10 de precio de lanzamiento hasta el 2026-08-31) y `claude-haiku-4-5` ($1 / $5, ventana de 200K). **No se rebaja el modelo por defecto sin datos**: emitir un hallazgo de auditoría es exactamente el tipo de tarea donde la capacidad importa, y la decisión de bajar debe apoyarse en la tasa de acuerdo con el auditor, que es justo lo que el registro de decisiones humanas empezará a medir desde el primer día.

Requisitos de implementación no negociables:

1. **Pensamiento adaptativo activo** (`thinking: {type: "adaptive"}`, que en Opus 5 es además el comportamiento por defecto). `max_tokens` acota pensamiento y respuesta juntos: dimensionarlo con holgura o la respuesta se trunca a media frase.
2. **Manejar `stop_reason: "refusal"` antes de leer el contenido.** Los clasificadores de seguridad pueden declinar una petición devolviendo HTTP 200 con contenido vacío. Código que lea `content[0]` sin comprobar antes el `stop_reason` se rompe.
3. **Activar el fallback de servidor** (`fallbacks: "default"`, cabecera beta `server-side-fallback-2026-07-01`), para que una negativa se reintente en otro modelo en la misma llamada en lugar de romper el análisis.

### D3 — Citas verificables por encima de salida estructurada

Ésta es la decisión de fondo, y hay que tomarla porque **la API no permite ambas cosas a la vez**: activar `citations` junto con `output_config.format` (salida estructurada por schema) devuelve un 400.

**Se elige `citations: {enabled: true}`.**

Con citas activadas, la respuesta se parte en bloques de texto y los bloques citados llevan un array `citations` en el que cada entrada trae el **texto literal citado** (`cited_text`) y su localización: para PDF, `page_location` con página inicial y final, en base 1. Esa cita **la produce la API a partir del documento**, no la redacta el modelo.

Con salida estructurada, en cambio, el schema garantiza la forma del JSON, pero el campo «cita» sería prosa generada por el modelo: texto que *parece* una cita y puede no existir en el documento. Eso es precisamente lo que prohíbe la regla de integridad normativa de `CLAUDE.md`, y anularía el principio evidence-first en el único punto donde de verdad importa.

Consecuencia asumida: la clasificación discreta y el nivel de confianza **no vienen garantizados por schema** y hay que extraerlos del texto y validarlos. La taxonomía —`conforme`, `no_conformidad_mayor`, `no_conformidad_menor`, `observacion`, `oportunidad_mejora`— la aportó el usuario el 2026-08-10 como fuente autorizada y queda fijada en el domain model. Se mitiga con un formato de cierre fijo y una sola enumeración cerrada; una respuesta que no parsee **se rechaza y se reintenta**, nunca se interpreta a ojo. Es un coste real y se acepta a cambio de que ninguna cita pueda ser inventada.

Esto resuelve además la pregunta abierta #3 del component-spec: el anclaje estable de la cita no hay que diseñarlo, lo da la API.

### D4 — Ejecución asíncrona sobre la Batches API, disparada por el Cron ya existente

Dato verificado que corrige una imprecisión del component-spec: en **Vercel Hobby una función admite 300 segundos** (5 minutos), tanto por defecto como de máximo, con fluid compute activo. Pro llega a 800s y a 1800s en beta. Un documento suelto cabe holgadamente; **un proyecto entero no** — `Hospital Laguna 2` tenía 86 requisitos, y cada uno es al menos una inferencia.

Se adopta la **Batches API** (`POST /v1/messages/batches`): hasta 100.000 peticiones por lote, la mayoría completan en menos de una hora, máximo 24 horas, resultados disponibles 29 días, y **50% de descuento sobre el precio estándar**.

La forma resultante encaja con lo que el proyecto ya tiene:

1. El endpoint de lanzamiento construye el lote y lo envía. Responde rápido, muy por debajo de los 300s.
2. Un **cron de Vercel** —el proyecto ya opera uno diario en `/api/cron/alerts`— consulta el estado y, al terminar, persiste los hallazgos.
3. Los resultados llegan **en cualquier orden**: se correlacionan por `custom_id`, nunca por posición.

Dos optimizaciones estructurales que hay que diseñar desde el principio, no añadir después:

- **Caché de prompt**: en un análisis, el documento es constante y el requisito varía. Poniendo el documento en el prefijo cacheado y el requisito después del punto de corte, 86 evaluaciones cuestan una escritura de caché (1,25×) y 85 lecturas (0,1×). El mínimo cacheable en Opus 5 es de 512 tokens.
- **Files API** (beta `files-api-2025-04-14`): el documento se sube una vez y se referencia por `file_id` en cada petición, en lugar de reenviar el binario en base64.

Combinadas, el coste marginal de evaluar un requisito más contra un documento ya cacheado es *(entrada cacheada × 0,1 × 0,5) + (salida × 0,5)*. **El coste absoluto no se estima aquí a ojo: se mide con `count_tokens` sobre documentos reales antes de comprometer un techo por auditoría.**

### D5 — Ingesta: PDF nativo, sin construir extractor propio en la primera versión

Los bloques `document` aceptan PDF directamente, con límite de **32 MB por petición y 600 páginas**. No se construye pipeline de extracción propio para PDF con capa de texto: sería reimplementar peor lo que la API ya hace, y además romper la citación, que depende de que el documento llegue como documento.

Quedan **fuera** de esta primera versión, cada uno con decisión propia pendiente: PDF escaneado sin capa de texto (exige OCR), e IFC/BIM (no es texto, es modelo de datos; el análisis geométrico es un problema distinto).

## Alternatives Considered

### Asignar el análisis IA al Rule Engine

Es lo coherente con la letra del spec del Evidence Graph y no habría requerido este ADR. Se descarta porque obliga a meter razonamiento probabilístico dentro de un componente definido en la arquitectura congelada como «motor de evaluación de reglas normativas». El daño no es nominal: al mezclar comprobaciones exactas con juicios estadísticos en un mismo registro, se pierde la capacidad de decir qué parte del resultado es reproducible. Un auditor externo no podría separar lo verificado de lo estimado.

### Construir antes el Knowledge Graph y evaluar contra la cláusula ISO estructurada

Es más fiel a la arquitectura y daría explicabilidad superior («incumple la 5.2.1 de ISO 19650-2:2021»). Se descarta para esta versión por dos razones. La primera es de calendario: el Knowledge Graph es Phase 3, tiene domain model pero cero implementación, y bloquearía el objetivo del producto durante meses. La segunda es legal y no se puede resolver programando: **el texto de la ISO 19650 tiene copyright** de ISO y AENOR, y volcarlo íntegro en la base y servirlo a los tenants es un riesgo de licencia. Los 177 `RequirementTemplate` actuales son paráfrasis de elaboración propia y no tienen ese problema. Se prevé un campo opcional `knowledgeNodeId` para anclar cada requisito a su cláusula cuando el Knowledge Graph exista.

### Salida estructurada con schema, y pedir al modelo que incluya la cita como texto

Da hallazgos con forma garantizada y simplifica el parseo. Se descarta por la razón central de D3: la cita sería prosa del modelo y podría no existir en el documento. Un informe de auditoría que cita un párrafo inexistente no es un bug, es responsabilidad profesional del auditor que lo firma.

### Dos pasadas — una con citas y otra para estructurar el resultado

Permitiría tener ambas cosas. Se descarta ahora por coste (duplica las inferencias por requisito) y porque la segunda pasada introduce un punto donde la cita verificada puede deformarse al reescribirse. Reconsiderable si el parseo del veredicto resulta frágil en la práctica.

### Ejecución síncrona dentro del límite de 300s

Con 300 segundos por función, un documento contra unos pocos requisitos cabría. Se descarta como arquitectura porque no escala a un proyecto completo, obligaría a trocear la operación de cara al usuario, y renuncia al 50% de descuento de la Batches API sin ganar nada a cambio: un análisis no es una operación interactiva y nadie espera mirando la pantalla.

## Consequences

### Positive

- Las citas son verificables por construcción: un revisor abre el PDF por la página indicada y comprueba el texto literal. Es evidence-first materializado, no declarado.
- El coste se reduce estructuralmente antes de escribir código: 50% por lote, 90% sobre la porción cacheada de la entrada. Ambas son propiedades del diseño, no optimizaciones posteriores.
- La frontera entre juicio y regla queda escrita antes de que exista el Rule Engine, en lugar de negociarse cuando ya haya código de ambos.
- El proyecto sigue en plan Hobby: 300s bastan para lanzar un lote, y el cron necesario ya existe y está en producción.
- Cambiar de modelo es configuración auditable, no refactor, porque la provenance ya obliga a registrarlo.

### Negative

- El veredicto y la confianza se extraen de texto, sin garantía de schema. Hace falta un parser estricto y una política de reintento explícita. Es el precio directo de D3.
- Un análisis deja de ser inmediato: el usuario lanza y consulta después. Exige estado visible de progreso en la interfaz, que hoy no existe.
- La Batches API añade una máquina de estados —enviado, en proceso, terminado, expirado— que hay que persistir y reconciliar. Un lote puede expirar a las 24 horas y ese caso hay que tratarlo.
- Aparece la primera dependencia de un servicio externo de pago en la ruta crítica del producto.
- PDF escaneado e IFC quedan sin cubrir; un cliente que entregue planos escaneados no obtiene análisis hasta que se decida el OCR.

### Risks

- **El coste real por auditoría se descubre tarde.** Mitigación: la regla de provenance ya obliga a registrar tokens y coste por inferencia; el consumo por proyecto debe ser consultable desde el primer despliegue, y hay que medir con `count_tokens` sobre documentos reales antes de fijar ningún techo.
- **Nadie sabe si la IA acierta.** El Benchmark Framework es un componente futuro, pero sin una medida de acuerdo con el auditor humano no se puede saber si el componente aporta o estorba. Mitigación mínima y gratuita: registrar desde el primer día la decisión humana sobre cada hallazgo (aceptado, corregido, rechazado). Ese registro es a la vez control de calidad y corpus de evaluación.
- **Fuga de tenant a través de la caché de prompt.** Un prefijo cacheado mal segmentado podría compartir contenido entre proyectos. Mitigación: la clave de caché es el conjunto documental del proyecto y nunca cruza `projectId`; debe existir un test de aislamiento explícito, como los TENANT-01/02/03 del Evidence Graph.
- **El texto extraído es una copia de documentación de cliente.** Queda sujeto al mismo régimen jurisdiccional del ADR-007 y al ciclo de purga del ADR-005. Almacenarlo sin contemplar la retención reabre por la puerta de atrás justo lo que ADR-005 gobierna.
- **Deriva de versión del modelo.** Una respuesta de hoy puede no reproducirse mañana. Mitigación: la provenance registra modelo, versión y versión de prompt; un hallazgo se reconstruye con los valores registrados, no con los vigentes.

## BAOS Architecture Alignment

Compatible con la arquitectura congelada. No crea componentes nuevos ni reinterpreta ninguno: sitúa el trabajo dentro de la **Audit Intelligence Platform**, definida en el baseline como «capa de IA gobernada sobre el runtime de auditoría», y precisa su límite con el **Rule Engine** sin absorberlo. CAOS, Training Factory, Benchmark Framework, Contradiction Engine y Knowledge Graph quedan intactos y fuera de alcance.

No introduce aprendizaje autónomo: no hay entrenamiento, ni ajuste, ni memoria que modifique el comportamiento del modelo entre auditorías. No elimina ningún control humano: la salida es propuesta y ninguna transición de estado ocurre sin decisión registrada de un auditor. El aislamiento multi-tenant se mantiene por la misma cadena que `EvidenceItem`, extendida explícitamente a la caché de prompt.

Respecto al **Explainability Framework**, este ADR es un prerrequisito: fija que toda conclusión asistida por IA queda anclada a un fragmento localizable del documento fuente y a un registro de provenance que permite reconstruir cómo se produjo.

## Related ADRs

- **ADR-003** — Evidence Graph Phase 1 Scoping: define el `EvidenceItem` y su `sourceRef`, que son la entrada de este componente.
- **ADR-004** — Evidence Graph Implementation Decisions: la subida por token firmado (Fase D) es prerrequisito duro; sin documentos en el almacén, este componente no tiene nada que analizar.
- **ADR-005** — Ciclo de cierre de auditoría: el contenido extraído y las inferencias registradas entran en el alcance de la exportación y la purga.
- **ADR-006** — El snapshot de versión describe el estado resultante: aplica a cualquier entidad versionada que introduzca el domain model de este componente.
- **ADR-007** — Jurisdicción UE, Frankfurt: el texto extraído es documentación de cliente y hereda el mismo régimen. Queda pendiente verificar la jurisdicción de procesado del proveedor de inferencia, que este ADR no resuelve.
