# ADR-007: Ubicar datos y cómputo en Frankfurt (UE) por jurisdicción

## Status

Accepted

## Date

2026-08-08

## Context

Hasta el 2026-08-08, BAOS tenía la base de datos Neon en `aws-eu-west-2` (Londres) y, desde el commit `f2e1465`, las funciones de Vercel en `lhr1` (Londres). Esa colocación se eligió por latencia: poner el cómputo junto al dato. Nadie eligió el país; Londres venía heredado de la creación del proyecto en abril.

El problema es que **Reino Unido quedó fuera de la Unión Europea tras el Brexit**. BAOS almacena documentación de auditoría ISO 19650 de clientes españoles: actas, planos, evidencia contractual. Para ese material, la pregunta "¿bajo qué jurisdicción vive el dato?" no es teórica, es parte de lo que un cliente pregunta antes de firmar y de lo que un auditor externo revisa. Responder "Reino Unido" obliga a una conversación sobre transferencias internacionales que responder "Alemania" evita por completo.

La decisión se fuerza ahora y no más tarde por dos motivos concretos:

1. **La región de un proyecto Neon es inmutable.** Su documentación es explícita: *"You cannot change the region for an existing project."* Cambiarla exige crear un proyecto nuevo y migrar. Cuanto más datos haya, más caro es.
2. **La región de un store de Vercel Blob tampoco se puede cambiar** una vez creado. El store `iso-saas-evidence` existe desde julio en `iad1` (Washington) por el valor por defecto del CLI, y sigue **vacío**. Mientras lo esté, rehacerlo cuesta cero. El día que entre el primer documento real de un cliente, deja de costar cero.

El inventario previo confirmó que la ventana estaba abierta de par en par: la base de producción no contenía **ningún dato de cliente**. De 29 usuarios, 26 eran cuentas `audit-*@example.com` generadas en pruebas manuales el 10-may; de 22 proyectos, 21 eran residuo de esas mismas pruebas.

## BAOS Principles Affected

- **Certification-ready** — la ubicación jurisdiccional del dato es material en una certificación. Una arquitectura que reparte datos de clientes europeos fuera de la UE arrastra ese punto a cada auditoría futura.
- **Security by design** — la jurisdicción determina qué autoridad puede requerir acceso al dato y bajo qué procedimiento. Es una propiedad de seguridad, no solo de cumplimiento.
- **Multi-tenant isolation** — sin efecto directo, pero el aislamiento pierde valor comercial si el continente donde reside el dato es discutible.
- **Governance-first** — la decisión es irreversible en la práctica; queda registrada aquí para que no se re-debata ni se revierta por inercia.

## Decision

**Datos y cómputo se ubican en Frankfurt, dentro de la UE:**

- Neon: proyecto `BAOS-produccion-fra` (`late-hat-22164008`) en `aws-eu-central-1`, con ramas `production` y `Test`.
- Vercel Functions: `"regions": ["fra1"]` en `vercel.json`.
- Vercel Blob: el store se creará en `fra1`. El actual, en `iad1` y vacío, se retira.
  ✅ **Ejecutado el 2026-08-10.** `iso-saas-evidence-fra` (`store_wyhryJCIVwjFEuMw`) en `fra1`, privado, vinculado a `iso-saas` en Production, Preview y Development. El store de `iad1` (`store_SPJ4WiRGmr7N39TV`) se borró **con 0 ficheros y 0 B**: la ventana que este ADR describía seguía abierta y el coste fue cero, como estaba previsto. Script: `scripts/blob-a-frankfurt.ps1`. **Con esto ADR-007 queda ejecutado en sus tres patas.**
  ⚠️ El store se creó en `iad1` en julio **por el valor por defecto de `--region` en el CLI**, no por un flag mal escrito: omitir el flag es suficiente para acabar en Washington.

### ⚠️ Alcance acotado el 2026-08-10: la inferencia IA queda fuera

Cuando se escribió este ADR, BAOS no llamaba a ningún modelo. Con ADR-008 sí lo hace, y eso obliga a precisar hasta dónde llega esta decisión.

**Verificado el 2026-08-10 en la documentación del proveedor**: la API de Anthropic **no ofrece inferencia en la UE**. El parámetro `inference_geo` admite únicamente `"us"` y `"global"`; el *workspace geo*, que gobierna el almacenamiento en reposo, admite **solo `"us"`** y es inmutable tras crear el workspace. No es una configuración pendiente de encontrar: la opción no existe.

**Decisión del usuario (2026-08-10): aceptar la transferencia con base legal** (DPA y cláusulas contractuales tipo), en lugar de mover la superficie de inferencia a Amazon Bedrock `eu-central-1` o Vertex UE. Motivo: sin clientes reales todavía, un contrato con otro proveedor cloud es coste sin beneficio presente.

Consecuencias que hay que asumir con los ojos abiertos:

- **Este ADR cubre el dato en reposo y el cómputo de BAOS, no la inferencia.** Neon, las funciones de Vercel y el store de Blob están en Frankfurt. El documento que se analiza **sale de la UE** durante el análisis.
- **La frase «sus documentos no salen de la UE» es falsa** y no puede aparecer en material comercial ni en un pliego.
- **La vía de vuelta queda abierta y verificada**: las citas —de las que depende ADR-008 D3— **están disponibles en Bedrock y Google Cloud**, así que cambiar de superficie no obligaría a rediseñar el componente. La abstracción `AIProvider` es lo que mantiene ese cambio barato.
- **Disparador para reconsiderarlo**: el primer cliente que pregunte dónde se procesan sus datos, o el primer pliego que lo exija.

La retención en el proveedor es una cuestión **distinta de la jurisdicción** y se resuelve aparte, en ADR-005: el recibo de purga declara el plazo de 30 días en vez de fingir que no existe.

**Los tres van juntos, no se parten.** Se descartó explícitamente la opción de mover solo el Blob a la UE dejando Neon en Londres: resolver la jurisdicción del binario y dejar sus metadatos —quién lo subió, a qué requisito responde, quién lo validó— bajo otra jurisdicción no resuelve nada y produce una respuesta ambigua a la única pregunta que importa.

La migración fue **selectiva, no un volcado**: se copiaron las 177 `RequirementTemplate` del catálogo global, los 3 usuarios reales con su hash de contraseña intacto y sus empresas. El residuo de pruebas se quedó en Londres. Producción arranca sin proyectos, decisión consciente del responsable de producto.

Justificación de Frankfurt frente a otras regiones UE: `fra1` / `aws-eu-central-1` es la única región donde **Vercel y Neon coinciden** dentro de la UE con soporte de primer nivel en ambos. Dublín (`dub1`) existe en Vercel pero Neon no ofrece `eu-west-1`; París (`cdg1`) existe en Vercel pero Neon no ofrece `eu-west-3`. Elegir cualquiera de esas habría vuelto a partir cómputo y dato, que es justo lo que ADR previo resolvió al mover las funciones a Londres.

## Alternatives Considered

### Quedarse en Londres

Coste cero, cero riesgo de migración, y las funciones ya estaban colocadas con la base desde `f2e1465`.

Se descarta porque el problema no es técnico sino jurisdiccional, y **empeora con el tiempo**: cada documento real que entrara haría la migración más cara, hasta volverse impracticable. El momento de menor coste era exactamente este, con la base sin datos de cliente y el store de Blob vacío. Reino Unido tiene decisión de adecuación de la Comisión Europea, así que la transferencia es legal hoy; pero esa decisión es revisable y su renovación es una dependencia externa que no controlamos.

### Mover solo el Blob a la UE, dejar Neon en Londres

Mucho menos trabajo: no exige crear un proyecto Neon ni migrar nada, solo crear el store en otra región.

Se descarta porque deja la jurisdicción partida. El binario estaría en la UE y su trazabilidad completa —autor, requisito vinculado, validación humana, versiones— en Reino Unido. Para un sistema cuyo producto es precisamente la trazabilidad, separar la evidencia de su cadena de custodia es lo peor de las dos opciones.

### Volcado íntegro de la base con `pg_dump` / `restore`

Copia fiel, sin decisiones sobre qué conservar.

Se descarta tras el inventario: habría arrastrado 26 usuarios de prueba y 21 proyectos basura a la base nueva, y habría metido `pg_dump`/`restore` en el camino crítico sin ganar nada. La copia selectiva es más simple de verificar (tres recuentos) y deja producción limpia de paso.

## Consequences

### Positive

- Datos y cómputo bajo jurisdicción UE plena, sin depender de una decisión de adecuación revisable.
- La pregunta "¿dónde vive el dato?" tiene una sola respuesta, verificable, para las tres piezas.
- Producción queda sin el residuo de pruebas del 10-may que arrastraba desde mayo.
- Coste monetario cero, verificado antes de mover: Neon free admite 100 proyectos con 0,5 GB y 100 CU-hora cada uno (se usan 56 MB), y Vercel Blob es gratuito en Hobby dentro de cupo, con el precio regional aplicable solo en Pro.
- Se hizo con la ventana abierta: 0 bytes en Blob y 0 datos de cliente en base.

### Negative

- Los 22 proyectos de Londres, incluido `Hospital Laguna 2` con 86 requisitos, no viajan. Quedan solo en el proyecto de Londres mientras exista.
- Latencia ligeramente mayor para usuarios en Reino Unido; irrelevante para una base de clientes española.
- Dos proyectos Neon activos hasta que se retire Londres, con la confusión que eso puede generar si alguien mira el sitio equivocado.

### Risks

- **Alguien apunta a la base equivocada.** Coexisten dos proyectos con esquemas idénticos. Mitigación: los scripts de `scripts/` llevan guarda de host y abortan si la URL no es la esperada; `.env` y `.env.test` apuntan a la rama `Test` de Frankfurt, nunca a producción.
- **Borrar Londres antes de tiempo.** Es la vía de vuelta: revertir es devolver `DATABASE_URL` a su valor anterior y redesplegar. No se borra hasta que haya pasado tiempo suficiente de funcionamiento normal.
- **La variable `DATABASE_URL` de Preview quedó apuntando a Londres** tras el corte: `vercel env add --force` informó de "Overrode" pero la fecha de la variable no cambió. Pendiente de recrearla. Si Londres se borrase antes, los despliegues de rama fallarían.

## BAOS Architecture Alignment

Compatible con la arquitectura congelada. No toca ningún Core Component ni ningún contrato funcional: cambia dónde se ejecuta y dónde reside lo que ya existía. No introduce aprendizaje autónomo, no elimina puntos de control humano, no altera el aislamiento multi-tenant ni la trazabilidad de la evidencia.

Verificación tras el corte: deploy `dpl_AiuCbMCFThG4ffxjXhLxmCVZ8WQF` con `regions: ["fra1"]`, actividad de cómputo confirmada en el proyecto de Frankfurt y ausente en el de Londres, `npm run smoke` en verde (14/14), suite completa contra Frankfurt en verde (101/101), y sesión real iniciada con el catálogo de plantillas visible.

## Related ADRs

- ADR-001: PostgreSQL con Prisma para el Canonical Data Model — fija el motor cuya ubicación aquí se decide.
- ADR-003: Evidence Graph Phase 1 Scoping — decide Vercel Blob como almacén de binarios; este ADR fija su región.
- ADR-005: Ciclo de cierre de auditoría — la retención y purga que define operan sobre datos cuya jurisdicción queda establecida aquí.
