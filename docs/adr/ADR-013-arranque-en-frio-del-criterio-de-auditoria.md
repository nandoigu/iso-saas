# ADR-013: Arranque en frío — el criterio de auditoría se escribe antes de que haya lecciones

## Status

Accepted

## Date

2026-08-11

## Context

ADR-009 diseñó con detalle **cómo aprende** el auditor IA: el auditor corrige un hallazgo, esa corrección se promueve a lección, el corpus se congela en versiones inmutables y se recupera por identidad del requisito.

**Lo que ADR-009 no dice en ningún punto es de qué parte.** Afirma que «el sistema mejora con el uso» sin preguntarse desde qué línea base. El corpus arranca vacío, y un mecanismo que perfecciona un criterio no sirve de nada si no hay criterio que perfeccionar. Es una dependencia sin declarar, del mismo tipo que la invariante #7 que apuntaba a un estado inexistente (corregida en `a1d139c`): la especificación se lee bien hasta que alguien pregunta por el estado inicial.

El defecto lo detectó el responsable de producto el 2026-08-11, y su consecuencia es la peor forma posible del problema: **la versión más floja del sistema es la que ve el primer cliente**, y son justo las primeras auditorías las que más corrección necesitan.

Con el corpus vacío, lo único que el modelo tiene al analizar es el enunciado del requisito y la taxonomía. Sabe leer el documento y sabe qué pregunta responder, pero nadie le ha dicho qué es una respuesta buena. No puede suplirlo con su conocimiento general de la ISO 19650: la regla de integridad normativa de `CLAUDE.md` prohíbe que el contenido normativo salga de otro sitio que no sea una fuente autorizada y validada por el proyecto.

La arquitectura congelada sí reserva sitio para esto —**Training Factory**, **Benchmark Framework**, y las fases 9 a 13 completas—, pero están sin especificar y muy por detrás en el plan. El componente diseñado esta semana depende de ellas **ahora**.

Dos hechos hacen el problema abordable: el responsable de producto **es** la fuente autorizada, y dispone de **auditorías ya realizadas, plantillas y procedimientos ya auditados**.

## BAOS Principles Affected

- **Evidence-first** — sin criterio de aceptación, el modelo no sabe qué buscar en el documento, y la cita que produzca puede ser literal y aun así irrelevante.
- **Explainability-first** — si el criterio cambia con el tiempo, un hallazgo antiguo deja de ser reconstruible salvo que conste con qué criterio se produjo. Es el mismo problema que ADR-009 resolvió para las lecciones.
- **Human-in-the-loop** — el criterio inicial es doctrina humana, no una destilación automática.
- **Certification-ready** — un auditor externo debe poder ver contra qué criterio se evaluó cada requisito.
- **Regla de integridad normativa** (`CLAUDE.md`) — el criterio es contenido normativo: solo puede venir de fuente autorizada, nunca generado por el propio modelo.

## Decision

### D1 — Criterio de aceptación y lección son cosas distintas

No se mezclan en la misma entidad. Tienen ciclos de vida opuestos:

| | **Criterio de aceptación** | **Lección** (ADR-009) |
|---|---|---|
| Qué es | Qué evidencia satisface el requisito | Qué falló la IA al valorarlo |
| Origen | Doctrina del experto | Una corrección concreta |
| Cuándo se escribe | Una vez, antes de empezar | Con el uso, indefinidamente |
| Se retira | No; se corrige | Sí, y revierte el comportamiento |
| Decisión de origen | No tiene | Obligatoria y rastreable |

Meter el criterio inicial como «lección» sería un error de categoría: no corrige nada, no tiene decisión de origen y no debe poder retirarlo un admin igual que se retira una lección equivocada.

### D2 — El criterio vive en `RequirementTemplate` y viaja en el Excel de la fuente

Es global, se escribe una vez y **se recupera por el mismo eje que las lecciones** —identidad de plantilla, o `norma` + `item`—, así que no introduce mecanismo nuevo de recuperación.

Su fuente autorizada son **los mismos tres Excel por función** de `docs/fuentes/` (ADR-010 los consagró como fuente), con **una quinta columna, `Criterio de Aceptación`**. Verificado en código: `hasRoleHeaders` detecta el formato por presencia de las cuatro cabeceras conocidas, no por conjunto exacto, así que una columna añadida no rompe la importación actual — solo se ignora hasta que el importador se amplíe.

⚠️ **No se reutiliza el campo legado `RequirementTemplate.evidencia`.** Está vacío en las 91 plantillas, pero lo usan 21 ficheros de producción y su semántica actual es otra. Campo nuevo, migración aditiva, **en la misma migración que ADR-010** para no hacer dos.

### D3 — Qué contiene cada criterio

Cuatro cosas, escritas por el experto y con sus palabras (nunca copiando texto de la norma, que tiene copyright de ISO y AENOR):

1. Qué documento o documentos lo satisfacen.
2. Qué debe encontrarse dentro — lo concreto y verificable, que es lo que después se podrá citar.
3. Qué **no** basta: los fallos típicos, el documento correcto pero incompleto, la mención genérica sin desarrollo.
4. **Dónde está la frontera entre no conformidad mayor y menor en ese requisito concreto.**

El cuarto punto es el de mayor rendimiento. ADR-008 fija que la IA propone la severidad y el humano confirma, pero hoy la IA no tiene con qué decidirla más allá de la definición genérica de la taxonomía. Un criterio de frontera por requisito mejora esa propuesta directamente y reduce el trabajo de corrección.

### D4 — Campaña de calibración como condición de salida antes del primer cliente

Antes de que ninguna auditoría real de un cliente pase por el sistema:

1. Se ejecuta el análisis sobre proyectos ya auditados, de resultado conocido.
2. El auditor corrige todo lo que salga mal.
3. Esas correcciones se promueven a lecciones.

**No exige arquitectura nueva**: usa el flujo de promoción de ADR-009 D5 tal como está diseñado. Es la vía más corta de un corpus vacío a uno útil, y de paso ejercita el mecanismo de aprendizaje antes de que dependa de él un cliente.

### D5 — Conjunto de referencia apartado, que nunca enseña

De las auditorías pasadas disponibles se **aparta un subconjunto con veredicto conocido que no se usa jamás para promover lecciones**, solo para medir. Sin él, «el sistema está mejorando» es una impresión y no un dato.

Es el **Benchmark Framework en su versión mínima**, sin construir infraestructura: unas cuantas auditorías marcadas como reservadas y una comparación entre el veredicto conocido y el propuesto.

### D6 — Reproducibilidad del criterio

Si el criterio de un requisito cambia, un hallazgo anterior deja de ser reconstruible, exactamente el problema que ADR-009 D2 resolvió versionando el corpus de lecciones.

**Se adopta la vía del snapshot**: el criterio vigente viaja en el payload de análisis y queda por tanto dentro de `inputDigest`, y además se guarda su texto junto a la inferencia. Es más barato que versionar `RequirementTemplate` entera y suficiente para reconstruir: un hash prueba que algo cambió, pero no permite recuperar el texto anterior.

⚠️ La forma exacta —campo en `AiInference`, o snapshot en el `AnalysisRun`— se fija en el paso de domain-model. Lo que este ADR fija es que **no vale con el hash**.

## Alternatives Considered

### Dejar que el corpus se llene solo con el uso

Es lo que ADR-009 implicaba sin decirlo. Se descarta por lo que ya se ha explicado: el primer cliente se lleva la peor versión, y sin criterio de partida las primeras correcciones no corrigen contra nada, con lo que el propio bucle de aprendizaje arranca sin referencia.

### Generar los criterios con la IA a partir de las plantillas

Tentador y rápido. **Prohibido por la regla de integridad normativa de `CLAUDE.md`**: los criterios de conformidad son contenido normativo y no pueden salir del modelo. Y metodológicamente sería medir al modelo contra su propio criterio, que no demuestra nada.

### Esperar a Training Factory y Benchmark Framework

Es donde la arquitectura congelada lo tenía previsto. Se descarta por calendario: están cinco fases por detrás y sin especificar, mientras que el componente los necesita ahora. Este ADR los adelanta **en versión mínima**, sin sustituirlos.

### Meter los criterios como lecciones iniciales del `LessonSet`

Ahorraría la migración y la columna nueva. Se descarta por D1: son entidades con ciclo de vida opuesto, y mezclarlas haría que retirar una lección equivocada pudiera llevarse por delante doctrina fundacional.

## Consequences

### Positive

- El sistema deja de arrancar a ciegas; el primer cliente ve una versión con criterio.
- **Coste de tokens despreciable**: un criterio de ~150 palabras pesa menos del 1% de lo que cuesta leer el documento al que acompaña.
- Las propuestas de severidad mejoran desde el primer análisis, que es donde más trabajo de corrección se ahorra.
- Aparece por primera vez una forma de **medir** si el aprendizaje funciona.
- No está en el camino crítico del código: escribir criterios y construir el componente son vías paralelas que se juntan en la calibración.

### Negative

- **Es trabajo humano real y no delegable**: 91 criterios escritos por el experto. Es el precio de que sean válidos.
- Migración y ampliación del importador, aunque se aprovechan las de ADR-010.
- El criterio pasa a ser contenido bajo gobernanza: cambiarlo tiene consecuencias de reproducibilidad (D6).
- La campaña de calibración añade un paso obligatorio antes de la primera venta.

### Risks

- **Criterios escritos una vez y nunca revisados.** Envejecen con la práctica profesional y con las ediciones de la norma. No hay hoy ningún disparador de revisión; conviene que lo haya antes de que el corpus crezca.
- **La frontera mayor/menor es subjetiva** y la fija una sola persona. Es el mismo sesgo del primer auditor que ADR-009 ya asumió, aquí concentrado en el arranque.
- **El conjunto de referencia será pequeño.** Con pocas auditorías apartadas, la medida tendrá mucho ruido: sirve para detectar un desastre, no para afinar.
- **Riesgo de contaminación del benchmark**: basta que alguien promueva una lección desde una auditoría reservada para invalidar la medición. Debe impedirse mecánicamente, no por disciplina.

## BAOS Architecture Alignment

Compatible con la arquitectura congelada, y **declara explícitamente la dependencia que ADR-009 dejó sin declarar**.

Adelanta en versión mínima dos Core Components —**Training Factory** (el corpus inicial y su gobierno) y **Benchmark Framework** (el conjunto de referencia)— sin sustituirlos ni rediseñarlos. Cuando se especifiquen, deben **absorber** lo que aquí se construye, igual que ADR-009 D6 estableció para CALS.

No introduce aprendizaje autónomo: el criterio lo escribe una persona, la calibración la conduce una persona y la medición no dispara ninguna acción automática.

## Related ADRs

- **ADR-009** — Aprendizaje gobernado por corpus de lecciones: este ADR cubre el hueco de su estado inicial y mantiene la separación entre criterio y lección
- **ADR-010** — Vínculo evidencia–requisito: consagra los Excel de `docs/fuentes/` como fuente autorizada; el criterio viaja en ellos y comparte su migración
- **ADR-008** — Audit Intelligence Platform: fija que la IA propone la severidad y el humano confirma; D3 de este ADR es lo que le da base para proponerla
- **ADR-006** — El snapshot describe el estado resultante: misma semántica aplicada al criterio en D6
