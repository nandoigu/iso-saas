# ADR-009: Aprendizaje gobernado por corpus de lecciones versionado

## Status

Accepted

## Date

2026-08-10

## Context

Al cerrar el domain model de la Audit Intelligence Platform (2026-08-10) se hizo explícita una discrepancia entre lo que el usuario esperaba del producto y lo que ADR-008 diseñaba: **el usuario esperaba que la IA mejorase por sí sola con el uso.**

No ocurre. Los pesos del modelo están congelados y cada llamada a la API es independiente: corregir un hallazgo guarda la corrección en nuestra base de datos, no en el modelo. Repetir mañana el mismo análisis con el mismo prompt produce el mismo razonamiento. El uso, por sí mismo, no entrena.

La expectativa, sin embargo, no era errónea: está en la propia arquitectura congelada de BAOS, con nombre propio —**CALS, «Continuous Audit Learning System — mejora continua gobernada»**, más Training Factory y Benchmark Framework— y con una fase conceptual dedicada. Lo que ocurre es que esos componentes están sin especificar y muy por detrás en el plan.

Planteadas cuatro vías de mejora (iterar el prompt a mano; inyectar correcciones como ejemplos; recuperar las correcciones relevantes en cada análisis; ajuste fino del modelo), **el usuario decidió meter la tercera en el alcance desde el principio**. Es la que se comporta como «mejora con el uso» sin tocar los pesos: el sistema mejora porque su contexto mejora.

Eso obliga a resolver ahora tres cosas que ADR-008 no contemplaba: cómo se mantiene la reproducibilidad si el contexto cambia con el tiempo, quién decide qué se aprende, y si lo aprendido con un cliente puede aplicarse a otro.

## BAOS Principles Affected

- **Explainability-first** — si el contexto de análisis cambia entre auditorías, un hallazgo antiguo deja de ser reconstruible salvo que se registre exactamente qué contexto se usó.
- **Governance-first** — que un criterio pase a afectar a todos los análisis futuros es un cambio de gobernanza, no una preferencia de usuario.
- **Human-in-the-loop** — el aprendizaje también se gobierna: nada se aprende sin un acto humano deliberado.
- **Multi-tenant isolation** — es el principio en mayor riesgo. Una lección que viaje entre clientes arrastrando contenido de origen es una fuga de datos.
- **Certification-ready** — un sistema cuyos criterios cambian sin dejar rastro produce informes que un tercero no puede verificar.

> ⚠️ **DEPENDENCIA NO DECLARADA, cubierta por ADR-013 (2026-08-11).** Este ADR describe cómo mejora el criterio pero **no dice de qué parte**: da por supuesto que existe un criterio inicial que las lecciones perfeccionan, y el corpus arranca vacío. El arranque en frío —criterios de aceptación escritos por el experto, campaña de calibración y conjunto de referencia apartado— se resuelve en **ADR-013**, que también fija que criterio de aceptación y lección son entidades distintas y no deben mezclarse. Todo lo que sigue en este ADR permanece en vigor.

## Decision

### D1 — Se aprende en el contexto, nunca en el modelo

BAOS **no ajusta, entrena ni modifica** ningún modelo. La mejora se produce inyectando en el prompt de análisis un conjunto de **lecciones** derivadas de correcciones humanas anteriores. El modelo sigue siendo un componente intercambiable y sin estado; lo que evoluciona es el material que se le da.

Consecuencia directa: la mejora es **reversible**. Retirar una lección devuelve el comportamiento anterior, cosa que un ajuste de pesos no permite.

### D2 — El corpus se congela en versiones inmutables

Las lecciones activas se materializan en un **`LessonSet`** numerado y de contenido inmutable. Toda alta o retirada de lección **crea una versión nueva**; nunca modifica una existente. Se sigue la semántica ya fijada en ADR-006: el snapshot de la versión N describe el estado resultante en N.

- Un `AnalysisRun` **fija su versión de set al enviarse** y no la cambia, aunque el lote tarde horas.
- `AiInference` registra la versión utilizada, junto al modelo y la versión de prompt.

Sin esto, el sistema mejoraría a costa de volverse irreproducible, que es exactamente el intercambio que BAOS no puede aceptar. Con esto, un hallazgo de marzo se reconstruye en septiembre aunque el corpus haya crecido: se sabe con qué lecciones se produjo.

### D3 — Recuperación determinista por identidad del requisito

Las lecciones aplicables a un requisito se seleccionan **por identidad**: misma plantilla de requisito, o en su defecto misma pareja `norma` + `item`. No hay búsqueda semántica ni embeddings en esta fase.

Motivos: es reproducible (la misma entrada selecciona siempre las mismas lecciones), es explicable ante un auditor (se puede decir exactamente por qué se aplicó una lección), y **no arrastra infraestructura nueva** — ni base vectorial, ni pipeline de indexación, ni una segunda fuente de verdad. La recuperación semántica queda para cuando exista volumen que la justifique y un Benchmark Framework que demuestre que aporta.

### D4 — Alcance global, con sanitización obligatoria y verificada

Una lección se aplica **a todos los clientes**, no solo a la empresa donde se originó. Decisión del usuario, tomada sobre la alternativa de acotarlas por tenant: con pocos clientes, un corpus por tenant no llega a acumular valor nunca.

El aislamiento se sostiene desplazando la garantía al momento de promover:

1. La lección es **texto nuevo que el auditor escribe**, no una copia de su nota de corrección. Un campo distinto, un acto distinto.
2. Se comprueba **mecánicamente** antes de guardar: la lección no puede contener el `citedText` del hallazgo de origen, ni el nombre del proyecto o de la empresa de origen, ni ser idéntica a la nota de la corrección.
3. Se guarda la **procedencia** (decisión de origen, empresa de origen) para que un admin pueda auditar después de dónde salió cada criterio.

⚠️ **Riesgo aceptado explícitamente**: estas comprobaciones detectan la copia literal, no la paráfrasis. Un auditor que reescriba con sus palabras un dato confidencial del cliente A puede llevarlo al contexto del cliente B, y ningún control automático lo va a impedir. Es el precio de la combinación elegida y queda registrado como tal.

### D5 — Promueve el auditor, en el momento de corregir; retira el admin

Quien corrige un hallazgo puede, en el mismo acto, convertir esa corrección en lección. Decisión del usuario sobre la alternativa de un paso de revisión separado a cargo de un admin.

Compensaciones incorporadas al diseño, porque esta vía acorta mucho el camino entre una opinión y un criterio que afecta a todos los clientes:

- **Solo se promueven decisiones de `corrected` o `rejected`.** Aceptar la propuesta de la IA no enseña nada nuevo.
- La lección **entra en vigor de inmediato** —que es lo que el usuario quiso— pero es **retirable por un admin** en cualquier momento.
- **Retirar no reescribe el pasado**: crea una versión nueva del set. Los hallazgos producidos con la versión anterior conservan su trazabilidad, y se puede listar exactamente a cuáles afectó una lección que resultó equivocada.
- Toda lección arrastra su decisión de origen, así que una lección discutible es siempre rastreable hasta quién y por qué.

### D6 — Frontera con CALS

Esto **no es CALS**. Lo que aquí se construye es inyección gobernada de contexto en el prompt: sin modificación de modelo, sin métricas de deriva de rendimiento, sin ciclo automático de reentrenamiento.

| | Aquí | CALS (futuro) |
|---|---|---|
| Qué cambia | El contexto del prompt | El modelo y sus criterios de evaluación |
| Quién lo dispara | Un auditor al corregir | El ciclo gobernado de mejora continua |
| Reversible | Sí, retirando la lección | Requiere versión nueva del modelo |
| Mide su propio efecto | No | Sí, es parte de su definición |

Cuando CALS se especifique, **debe absorber este mecanismo, no duplicarlo**. Este ADR es el registro de que el germen existía antes y de dónde vive.

## Alternatives Considered

### Recuperar las correcciones en vivo, sin versionar

Es lo más simple: consultar las correcciones vigentes en cada análisis. Se descarta porque destruye la reproducibilidad — el mismo run repetido dos días después daría otro resultado sin que nada lo explique, y un informe de auditoría dejaría de ser reconstruible. Es precisamente lo que ADR-006 y la regla de provenance existen para impedir.

### Acotar las lecciones a la empresa donde se originaron

Cero riesgo de fuga y trivial de defender ante un cliente. Se descarta por decisión del usuario: con la cartera actual, un corpus por tenant no alcanza masa crítica y el sistema no mejoraría de forma perceptible. Queda como vía de vuelta — el modelo guarda la empresa de origen de cada lección, así que restringir el alcance más adelante es filtrar, no migrar.

### Revisión por admin antes de que una lección entre en vigor

Es lo que yo recomendaba: separa corregir de enseñar, dos actos con consecuencias muy distintas. Se descarta por decisión del usuario en favor de la agilidad y del contexto fresco de quien acaba de ver el documento. La retirada por admin y la trazabilidad de origen son la mitigación acordada.

### Búsqueda semántica de correcciones relevantes

Encontraría lecciones aplicables a requisitos parecidos pero no idénticos. Se descarta ahora por coste de infraestructura (base vectorial, indexación, una segunda fuente de verdad) y porque introduce una selección que no se puede explicar de forma determinista ante un auditor. Reconsiderable con volumen real y con Benchmark Framework capaz de demostrar la mejora.

### Ajuste fino del modelo

Sería la mejora más profunda. Se descarta en esta fase: es un proceso offline, versionado y con evaluación previa —no «aprender del uso»—, exige un corpus que todavía no existe, y su disponibilidad habría que verificarla. Pertenece a Training Factory.

## Consequences

### Positive

- El sistema mejora con el uso, que era la expectativa del usuario, sin romper explicabilidad ni gobernanza.
- La mejora es reversible y auditable: se puede retirar una lección y saber a qué hallazgos afectó.
- No añade infraestructura: las lecciones son filas en Postgres y texto en el prompt.
- El registro de decisiones humanas que ADR-008 ya preveía deja de ser solo corpus futuro y pasa a tener uso inmediato.
- Deja escrita la frontera con CALS antes de que CALS exista.

### Negative

- Añade dos entidades, un flujo de promoción y una pantalla de gestión de lecciones que hoy no existe.
- Cada alta o retirada crea una versión de set: el corpus de versiones crece de forma monótona y entra en el alcance de la retención del ADR-005.
- El prompt de análisis deja de ser fijo, lo que complica la caché: las lecciones deben colocarse **después** del prefijo cacheado del documento para no invalidarlo.
- Una lección mal escrita degrada todos los análisis futuros hasta que alguien la retire.

### Risks

- **Fuga por paráfrasis.** Las comprobaciones mecánicas no detectan que un auditor reescriba con sus palabras un dato confidencial. Riesgo aceptado en D4. Mitigación parcial: procedencia registrada y revisión periódica del corpus por un admin, que conviene convertir en rutina y no en buena intención.
- **Deriva de criterio sin que nadie lo note.** El corpus puede acumular lecciones contradictorias entre sí. No hay hoy detección de contradicción — es competencia del Contradiction Engine, que no existe. Mitigación mínima: mantener el corpus pequeño y revisable a ojo mientras no haya nada mejor.
- **Sesgo del primer auditor.** Con poco volumen, quien más corrija fija los criterios de todos. Es inherente a la vía elegida; se atenúa solo con volumen y con revisión.
- **Coste de contexto creciente.** Cada lección inyectada suma tokens en cada análisis. Hay que vigilar el tamaño del conjunto aplicable por requisito y fijar un tope antes de que el coste por auditoría se dispare.

## BAOS Architecture Alignment

Compatible con la arquitectura congelada, con una precisión de frontera declarada en D6. No modifica modelos, no introduce aprendizaje autónomo —toda alta de lección es un acto humano deliberado y toda retirada también—, y no elimina ningún punto de control humano.

Refuerza el **Explainability Framework**: un hallazgo pasa a ser reconstruible no solo por modelo, versión y prompt, sino también por el conjunto exacto de criterios acumulados que estaban vigentes cuando se produjo.

Toca el principio de **multi-tenant isolation** de forma deliberada y acotada, con la garantía desplazada al momento de promoción y con el riesgo residual documentado en D4.

## Related ADRs

- **ADR-008** — Frontera del análisis IA y elección de proveedor: define el componente y el registro de decisiones humanas que este ADR convierte en corpus de aprendizaje.
- **ADR-006** — El snapshot de versión describe el estado resultante: `LessonSet` sigue esa misma semántica.
- **ADR-005** — Ciclo de cierre de auditoría: las versiones de corpus entran en el alcance de la retención.
- **ADR-002** — Multi-tenant por columna: este ADR introduce la primera excepción deliberada al aislamiento, acotada a texto sanitizado y verificada al promover.
