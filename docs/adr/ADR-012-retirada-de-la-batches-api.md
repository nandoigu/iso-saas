# ADR-012: Se retira la Batches API; el análisis se ejecuta en rodajas encadenadas

## Status

Accepted

## Date

2026-08-11

## Context

ADR-008 D4 adoptó la **Batches API** por dos motivos distintos que conviene separar, porque solo uno de ellos sigue en pie:

1. **Precio.** 50% de descuento sobre el estándar.
2. **El límite de 300 segundos por función** en Vercel Hobby. Un proyecto entero no cabe en una invocación, así que el endpoint de lanzamiento enviaba el lote y un cron recogía los resultados después.

Dos hechos posteriores cambian el balance:

**El primero, la medición del 2026-08-11** (ADR-011). Se creía que una auditoría costaba unos 30 dólares de entrada; con el rutado declarado de ADR-010 cuesta **algo más de un dólar**. El 50% de descuento pasa de valer quince dólares a valer **cincuenta céntimos**.

**El segundo, la caché de prompt.** ADR-011 fija que el análisis se ordena por documento para que las peticiones que comparten prefijo vayan seguidas y la caché las abarate. Pero **la caché y los lotes son incompatibles**: el TTL es de 5 minutos por defecto y 1 hora en su versión extendida, mientras que un lote puede tardar hasta 24 horas. Con Batches, cuando llega el turno de la segunda petición de un documento, la caché ha expirado. Se cobra la mitad de un trabajo que no hacía falta rehacer.

Y sobre eso pesan dos problemas que Batches arrastra y que ya estaban documentados:

- **Es la única pieza que impide la retención cero.** Todas las demás superficies que usa el componente son elegibles para ZDR —Messages API, PDF en línea, citas, caché de prompt, `count_tokens`—; Batches no. Mientras esté, el recibo de purga de ADR-005 no puede declarar otra cosa que los 30 días del proveedor.
- **Su fallo es el más caro y el más silencioso del componente.** Un lote caduca a las 24 horas, el dinero ya se gastó, no hay error visible y el run se queda en `processing` para siempre. Nadie se entera hasta que alguien pregunta.

## BAOS Principles Affected

- **Evidence-first** — un run que se queda colgado sin avisar produce una auditoría incompleta que aparenta estar en marcha. Eliminar ese modo de fallo protege la integridad del resultado.
- **Governance-first** — la retención del proveedor es un compromiso contractual con el cliente; el recibo de ADR-005 solo puede declarar lo que la arquitectura permite.
- **Explainability-first** — con rodajas, el estado de un run es observable requisito a requisito, no un identificador opaco de lote.

## Decision

**Se retira la Batches API. El análisis se ejecuta de forma sincrónica, troceado en rodajas encadenadas.**

1. **La unidad de trabajo es la que fija ADR-011**: un requisito con sus documentos, ordenadas por documento para que la caché funcione.
2. **Cada invocación procesa las rodajas que le caben en los 300 segundos** y encadena la siguiente. El run avanza sin intervención y sin esperar a un reloj externo.
3. **Desaparece el cron de reconciliación.** No es que se sustituya: deja de existir el estado que había que reconciliar. El progreso se persiste rodaja a rodaja, así que un fallo deja el run detenido en un punto conocido y reanudable, no en un limbo silencioso.
4. **Se usa la caché con TTL extendido de 1 hora** (`cache_control: {type: "ephemeral", ttl: "1h"}`). La escritura pasa a costar 2× en vez de 1,25×, y aun así el caso del BEP —un documento de 200 páginas que es evidencia de una docena de requisitos— baja de un multiplicador de 12 a uno de 3,1.

**El mecanismo exacto del encadenamiento queda como decisión de implementación**, no de arquitectura. La opción natural en Vercel es que la invocación dispare la siguiente antes de terminar, con la salvedad conocida de que el trabajo diferido tras responder necesita un mecanismo explícito para que la plataforma no corte la función. Se elegirá al implementar, midiendo, y **no depende de la frecuencia de los cron jobs del plan Hobby**, dato que no se ha podido verificar en la documentación y que esta decisión deja de necesitar.

## Alternatives Considered

### Mantener Batches y renunciar a la caché

Es el diseño de ADR-008 D4 tal cual. Ahorra el 50% de un coste de un dólar —cincuenta céntimos— y a cambio conserva el fallo silencioso, impide la retención cero y desperdicia un ahorro mayor que el que consigue. Cuando se creía que la auditoría costaba treinta dólares la aritmética salía al revés; con las cifras reales, no.

### Mantener Batches solo para runs grandes

Un umbral por tamaño obligaría a mantener **las dos** máquinas de estados, con dos modos de fallo distintos y dos rutas de reconciliación, para ahorrar céntimos en una fracción de los casos. Complejidad permanente a cambio de nada.

### Subir a Pro para tener 800 segundos por función

No resuelve el problema de fondo —un proyecto completo tampoco cabe en 800 segundos— y contradice la decisión del 7-ago de seguir en Hobby hasta que un límite real bloquee trabajo. El troceado hace falta igualmente.

## Consequences

### Positive

- **Queda abierta la vía a la retención cero.** Todas las superficies que el componente usa pasan a ser elegibles para ZDR. ⚠️ No significa que ya sea cero: ZDR se negocia con ventas y es para clientes comerciales. Lo que cambia es que deja de haber un impedimento técnico, y el recibo de ADR-005 podría declarar algo mejor que 30 días si algún día se negocia.
- **Desaparece el modo de fallo más caro y silencioso del componente.**
- La caché de prompt pasa de ser inútil a ser la principal palanca de ahorro.
- El usuario ve progreso real —requisitos completados— en vez de un lote opaco.
- Un fallo se reintenta desde el punto exacto donde se quedó.

### Negative

- **El análisis cuesta el doble que con lotes**: unos cincuenta céntimos más por auditoría. Aceptado explícitamente.
- Aparece la responsabilidad de encadenar invocaciones, que Vercel gestionaba antes por nosotros a través del cron. Es código propio y hay que probarlo.
- Cada rodaja debe caber en 300 segundos. Con documentos muy grandes y peticiones lentas, el tamaño de rodaja puede bajar a una sola petición, lo que alarga el run en número de invocaciones.
- El descuento del 50% se pierde también en el caso hipotético de una auditoría enorme, donde sí habría sido dinero real.

### Risks

- **Una cadena rota deja el run detenido.** Es mejor que el fallo anterior porque el punto de parada es conocido y visible, pero necesita igualmente una forma de reanudar: un endpoint de continuación, o una comprobación al abrir el run. Hay que diseñarla, no darla por hecha.
- **La caché de 1 hora impone un ritmo.** Si un run se detiene más de una hora a mitad de un documento, al reanudar paga la escritura otra vez. No es un error, es coste; conviene medirlo antes de fijar techos de gasto.
- **El mecanismo de encadenamiento en Vercel tiene trampas conocidas** con el trabajo posterior a la respuesta. Es el punto que más atención pide en la implementación.

## BAOS Architecture Alignment

Compatible con la arquitectura congelada. **Supersede el punto D4 de ADR-008** y solo ese punto: D1, D2, D3 y D5 siguen íntegramente en vigor, incluidas las citas y el PDF en línea. No cambia la frontera del componente, ni el modelo de dominio, ni la taxonomía, ni ningún punto de control humano.

Refuerza dos principios en vez de tensionarlos: elimina un estado en el que una auditoría puede quedarse incompleta aparentando estar en curso, y retira el último obstáculo técnico entre el producto y una promesa de retención que hoy no se puede hacer.

## Related ADRs

- ADR-008: Audit Intelligence Platform — **supersede su punto D4**; el resto queda intacto
- ADR-011: Unidad de análisis y troceado — deja esta decisión explícitamente abierta; aquí se cierra
- ADR-005: Ciclo de cierre de auditoría — el recibo de purga podría declarar retención cero si algún día se negocia ZDR
