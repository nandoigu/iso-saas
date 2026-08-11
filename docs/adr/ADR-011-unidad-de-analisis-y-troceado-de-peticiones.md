# ADR-011: La unidad de análisis es un requisito con sus documentos; el troceado se ordena por documento

## Status

Accepted

## Date

2026-08-11

## Context

ADR-008 D5 decidió que el PDF viaja **en línea** en cada petición, para que no quede ninguna copia en el proveedor que después haya que borrar. La consecuencia quedó anotada como el mayor problema abierto del componente: si se envía una petición por requisito, el documento entero se retransmite y se refactura una vez por requisito.

Hasta el 2026-08-11 no había cifras. El método estaba fijado en ADR-008 y nunca se había ejecutado. Se midió con `messages.count_tokens` —que no consume tokens de modelo y no tiene coste— sobre un documento real (`Plantilla-Manual BIM-V01.pdf`, 66 páginas, 1,35 MB) contra `claude-opus-5`:

| | tokens |
|---|---|
| El documento completo | **160.390** |
| El enunciado de un requisito | 192 |

**Reenviar el documento cuesta 835 veces lo que cuesta la pregunta.** De ahí se derivan dos constantes que gobiernan todo el componente:

- **≈ 2.430 tokens por página.** Los MB no predicen nada: un plano escaneado de 10 MB puede ser una página y un manual de texto de 3 MB, cuatrocientas.
- **≈ 410 páginas por petición** es el techo real, impuesto por la ventana de contexto de 1M. El límite de 600 páginas de la API queda por encima, y el de 32 MB no llega a morder nunca.

Al mismo tiempo, ADR-010 fijó que el usuario declara a qué requisito corresponde cada documento. Eso cambia la pregunta: ya no hay que decidir cómo agrupar 38 requisitos contra un documento, porque cada documento solo se enfrenta a los requisitos para los que fue aportado.

## BAOS Principles Affected

- **Evidence-first** — cada hallazgo se levanta sobre los documentos declarados para ese requisito, y su cita apunta a uno concreto con su página.
- **Explainability-first** — un hallazgo debe poder reconstruirse. La unidad de petición determina qué entradas exactas hay que registrar en `AiInference` para poder reproducirlo.
- **Human-in-the-loop** — el hallazgo por ausencia de evidencia no lo produce un modelo; hay que distinguirlo de una propuesta de IA para no atribuirle una autoría que no tiene.
- **Governance-first** — las cifras y los límites quedan registrados para que decisiones futuras de coste no vuelvan a estimarse a ojo.

## Decision

**1. La unidad de análisis es un requisito con todos sus documentos declarados.**

Una petición contiene los documentos que el usuario colgó en ese requisito y el enunciado del requisito, y produce **un hallazgo**. Coincide exactamente con la invariante #12 ya escrita (`@@unique([analysisRunId, requirementId])`): un hallazgo por requisito y run. El diseño y la interfaz apuntan al mismo sitio sin forzar ninguno de los dos.

**2. Un requisito sin evidencia es NO CONFORMIDAD y no se envía a analizar.**

Decisión del responsable de producto. Es una regla determinista: no hay documento, no hay nada que leer. El hallazgo se levanta sin inferencia.

- **Severidad: NO CONFORMIDAD MAYOR.** La ausencia total de evidencia es un incumplimiento grave, no un defecto fácilmente subsanable. Como toda no conformidad mayor, exige plan de acción correctiva.
- **Sin provenance de IA, y marcado como tal.** `CLAUDE.md` exige provenance a toda inferencia que influya en un resultado de auditoría. Aquí no hay inferencia, así que el hallazgo debe llevar un **origen explícito distinto** (regla determinista, no propuesta del modelo) y no puede aparentar que lo dijo la IA. La relación con `AiInference` es opcional para estos hallazgos, obligatoria para el resto.
- Sin cita, porque no hay nada que citar. Esto es coherente con el diseño: la cita se exige a `conforme` y a `oportunidad_mejora`, no a las no conformidades.

**3. El análisis se ordena por documento, no por requisito, para aprovechar la caché de prompt.**

El caso que se dará siempre es el BEP: un plan de ejecución de 200 páginas es evidencia de una docena de requisitos y se enviaría doce veces. Ordenando el run por documento, la primera petición escribe la caché (1,25×) y las siguientes la leen (0,1×). El multiplicador de ese documento baja de 12 a 2,35: **cinco veces más barato en el único caso que duele**.

El mínimo cacheable en `claude-opus-5` es de 512 tokens, así que cualquier documento real lo supera con holgura.

**4. Se abandona la agrupación de requisitos como palanca.**

Era la vía 1 de las dos que ADR-008 dejó abiertas, y con el rutado de ADR-010 pierde su objeto: un documento ya no se enfrenta a los 38 requisitos, sino a los suyos. La caché —vía 2, que se creía descartada por el TTL— resulta ser la buena, precisamente porque el orden por documento hace que las peticiones que comparten prefijo vayan seguidas.

**5. Un documento de más de ~400 páginas hay que partirlo, y al partirlo hay que reajustar las citas.**

Las citas devuelven `page_location` en base 1 **relativa al fragmento enviado**. Al recomponer el hallazgo, el número de página debe reajustarse al documento completo, o la cita apuntará al sitio equivocado. De esa cita depende ADR-008 D3.

## Alternatives Considered

### Agrupar varios requisitos en una petición

Era la vía preferida antes de medir y antes de ADR-010. Con un solo documento y 38 requisitos, meterlos todos en una petición bajaba la entrada de $30,51 a $0,84. Pero con varios documentos el número de grupos multiplica el corpus **entero**: sobre 2.000 páginas, pasar de un grupo a cuatro sube de $24,30 a $97,20. Con el rutado declarado la agrupación deja de ser necesaria, y con corpus reales habría sido contraproducente.

### Apoyarse solo en la caché, manteniendo una petición por requisito y documento

Es lo que se hace, pero conviene registrar por qué la caché sola no bastaba antes: con el documento cambiando en cada petición no hay prefijo compartido que cachear. Solo funciona porque el orden por documento lo crea.

### Files API para no reenviar el binario

Ya descartada en ADR-008 D5 y no se reabre: retenía indefinidamente hasta borrado explícito, y un borrado fallido no avisa, lo que volvería falso el recibo de purga de ADR-005.

## Consequences

### Positive

- El coste pasa a ser proporcional a la documentación realmente aportada. La unidad práctica es **≈ $12 por cada mil páginas leídas una vez**, a precio de entrada de `claude-opus-5`.
- Desaparece el multiplicador de 38 que bloqueaba el componente.
- Los requisitos sin evidencia no cuestan nada: en una primera auditoría, donde falta buena parte de la documentación, el gasto baja solo.
- El reintento parcial se simplifica: la unidad de fallo es un requisito, no un lote entero.

### Negative

- **La caché obliga a que las peticiones de un mismo documento vayan seguidas**, lo que restringe cómo puede planificarse el run.
- **Tensión directa con Batches.** El TTL de la caché es de 5 minutos por defecto y 1 hora en su versión extendida; un lote puede tardar hasta 24 h. Si el run va por Batches, la caché habrá expirado para casi todas las peticiones y el descuento del 50% se paga perdiendo un ahorro mayor. **Queda abierto si se retira Batches** — ver Riesgos.
- Una vez agrupado, el documento deja de ser el problema de coste: la entrada de una auditoría típica y su salida (los hallazgos con sus citas) pasan a ser del mismo orden. El control de coste se desplaza a cuánto texto generan los hallazgos, que no está acotado hoy.
- Los documentos de más de ~400 páginas necesitan troceo y reajuste de páginas en las citas: código nuevo y una fuente de error nueva.

### Risks

- **Retirar Batches es una decisión pendiente con consecuencias grandes en las dos direcciones.** Batches es la última pieza que separa el diseño de la retención cero (ADR-005) y la que trae el fallo del cron de reconciliación, documentado como el más caro y el más silencioso del componente: los lotes caducan a las 24 h, el dinero ya se gastó y el run se queda en `processing` sin error visible. Renunciar al 50% de descuento sobre un coste de un dólar largo puede salir barato. **No se decide aquí.**
- **La medición se hizo sobre un único documento.** 2.430 tokens por página es una media razonable para un manual con texto e imágenes, pero un documento sin apenas texto o uno con planos densos se desviará. Antes de fijar cualquier techo de gasto por proyecto conviene medir dos o tres documentos más, con `scripts/medir-tokens-pdf.mjs`.
- **Sin techo de gasto, nada impide lanzar un run carísimo.** El contrato expone `estimatedInputTokens` al crear el run; sigue sin decidirse si el techo es bloqueo duro, aviso o límite por proyecto. Ahora hay cifras para fijarlo.

## BAOS Architecture Alignment

Compatible con la arquitectura congelada. Implementa la **Audit Intelligence Platform** sin rediseñarla: no cambia la frontera del componente, ni el modelo de dominio, ni la taxonomía de hallazgos. Fija cómo se trocea la ejecución y con qué cifras, que es materialización tecnológica.

El hallazgo por ausencia de evidencia merece atención de alineamiento y por eso se marca explícitamente: es la primera conclusión de auditoría del sistema que **no** procede de una inferencia. No viola explainability-first —al contrario, es trivialmente reconstruible: no había documentos— pero sí exige que su origen conste, para que el sistema no atribuya al modelo una conclusión que tomó una regla.

## Related ADRs

- ADR-008: Audit Intelligence Platform — fija el PDF en línea (D5) y las citas (D3); este ADR cierra la pregunta que aquél dejó abierta
- ADR-010: Vínculo evidencia–requisito declarado y validado — aporta el rutado que hace posible esta unidad de análisis
- ADR-005: Ciclo de cierre de auditoría — la decisión pendiente sobre Batches afecta directamente al recibo de purga
- ADR-009: Aprendizaje gobernado por corpus de lecciones — las lecciones inyectadas deben ir **después** del prefijo cacheado para no invalidarlo
