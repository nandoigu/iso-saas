# Component Spec: Audit Intelligence Platform

> BAOS Component: Audit Intelligence Platform
> Module: Análisis de cumplimiento documental (Document Compliance Analysis)
> Phase: Slice inicial sobre Phase 1 Foundation — el componente completo pertenece a la capa Intelligence
> Date: 2026-08-10
> Status: Draft

---

## Strategic Purpose

La Audit Intelligence Platform es la capa de IA gobernada que lee la documentación real de un proyecto y **propone**, requisito a requisito, si la ISO 19650 se observa o no, justificando cada propuesta con la cita concreta del documento que la sustenta. Convierte BAOS de un sistema donde el humano declara el cumplimiento a uno donde el sistema lo analiza y el humano lo decide, sin ceder en ningún punto la autoridad final del auditor.

Es el componente que materializa el objetivo del producto. Todo lo construido hasta hoy (proyectos, requisitos, evidencias, informes) es el soporte sobre el que este componente opera.

---

## Architectural Position

| Attribute | Value |
|-----------|-------|
| BAOS layer | Intelligence |
| Implementation phase | Slice inicial sobre Phase 1 Foundation |
| Entry point | Fijado en `docs/api-contracts/audit-intelligence-platform.md`: `app/api/analysis-runs/*` (ciclo del run y cierre), `app/api/findings/*` (revisión y decisión), `app/api/cron/analysis-reconcile` (reconciliación del lote), `app/api/admin/audit-lessons/*` y `app/api/admin/lesson-sets/*` (corpus). Servicios: `analysis-run`, `analysis-finding`, `audit-lesson`, y `ai-provider` como único módulo autorizado a importar el SDK. ⚠️ **Corregido el 2026-08-10**: ya no hay `extraction.service.ts` — ADR-008 (D5) elimina el extractor propio. |
| Persistence | Modelos Prisma fijados en `docs/domain-models/audit-intelligence-platform.md`: `AnalysisDocument`, `AnalysisRun`, `AnalysisFinding`, `FindingCitation`, `FindingDecision`, `AiInference`, más `AuditLesson` y `LessonSet` para el aprendizaje gobernado (ADR-009) |
| Boundary | Posee la extracción de contenido de los documentos de evidencia, el análisis IA que los confronta con los requisitos, los hallazgos propuestos y la provenance de toda inferencia. NO posee el ciclo de vida de la evidencia, ni el veredicto final de cumplimiento, ni la redacción del informe. |

### Conflicto de frontera declarado

`docs/component-specs/evidence-graph.md` (línea 72) afirma que evaluar si un requisito normativo se cumple *"es responsabilidad del futuro Rule Engine"*. Este spec **no lo contradice, lo delimita**:

| Componente | Qué evalúa | Naturaleza del resultado |
|---|---|---|
| **Rule Engine** (futuro) | Reglas deterministas y verificables: presencia de un documento obligatorio, fechas dentro de plazo, formatos, campos requeridos | Verdadero/falso reproducible |
| **Audit Intelligence Platform** (este) | Juicio sobre contenido en lenguaje natural: si lo que dice un documento satisface lo que exige un requisito | Propuesta razonada con confianza y citas |
| **Auditor humano** | Ambas | **Veredicto** |

Son dos motores distintos que se prueban, se auditan y fallan de forma distinta. Mezclarlos en un componente haría imposible razonar sobre la fiabilidad de cada uno.

⚠️ Esta delimitación modifica el alcance implícito atribuido al Rule Engine en un spec ya aceptado. **Requiere ADR** (siguiente número libre: ADR-008) antes de pasar al domain model.

---

## Dependency Map

### Upstream (what this component consumes)

| Dependency | Type | What it provides |
|-----------|------|-----------------|
| `EvidenceItem` + `sourceRef` | Prisma / Evidence Graph | El documento a analizar y su pertenencia al proyecto |
| Vercel Blob (Fase D) | External | El binario real del documento. **Sin Fase D este componente no tiene entrada** |
| `Requirement` model | Prisma | El texto del requisito contra el que se contrasta (ver decisión de base normativa) |
| `Project` model | Prisma | Ámbito de tenant y contexto del proyecto (rol, norma aplicable) |
| `User` / `app/lib/auth.ts` | Internal | Actor para `createdBy`, `reviewedBy` y RBAC |
| Abstracción `AIProvider` | Internal (a crear) | Invocación del modelo sin acoplar el dominio a un proveedor |

### Downstream (what depends on this component)

| Dependent | Type | What it needs from here |
|----------|------|------------------------|
| Auditor humano (UI, a construir) | Internal API | Hallazgos propuestos con su justificación y citas, para aceptar o corregir |
| `Requirement.status` | Service call | El estado final lo escribe la decisión humana sobre un hallazgo, nunca el análisis |
| Evidence Graph | Service call | Un hallazgo aceptado justifica crear `EvidenceRequirementLink` con su `linkType` |
| `audit-report.generator.ts` | Service call | Hallazgos aceptados como base de las conclusiones del informe |
| Explainability Framework (futuro) | Data | Registro de provenance para reconstruir cualquier conclusión asistida por IA |
| Benchmark Framework (futuro) | Data | Pares (propuesta IA, decisión humana) como corpus de evaluación |
| Contradiction Engine (futuro) | Event | Hallazgos que contradicen otra evidencia ya validada |

### External dependencies

| Dependency | Purpose | Risk if unavailable |
|-----------|---------|-------------------|
| Proveedor LLM (a decidir en ADR) | Inferencia | El análisis no se puede ejecutar; los hallazgos ya emitidos siguen íntegros y consultables |
| Vercel Blob | Origen del documento | No hay nada que extraer |
| Neon PostgreSQL | Persistencia de extracciones, hallazgos y provenance | Full outage |

---

## Functional Scope

### This component IS responsible for

- **Preparar** un documento de evidencia para análisis: registrarlo en el proveedor, determinar páginas y tipo, y decidir si es analizable (un PDF escaneado sin capa de texto se marca no soportado y no consume inferencias). ⚠️ **Corregido el 2026-08-10 por ADR-008 (D5)**: el PDF viaja nativo a la API y **no se persiste texto extraído**; las citas con página las produce la propia API. La redacción anterior preveía un extractor propio que ya no se construye.
- **Ejecutar** un análisis que confronta el contenido extraído con los requisitos del proyecto.
- **Producir hallazgos propuestos** por requisito: veredicto propuesto, nivel de confianza, justificación en lenguaje natural y **cita literal del fragmento** que la sostiene.
- **Registrar la provenance completa** de cada inferencia, según la regla fijada en `CLAUDE.md`: modelo, versión, versión de prompt, inputs, parámetros, timestamp, salida cruda, tenant/proyecto/auditoría, tokens, coste y latencia.
- **Versionar los prompts** como artefacto de gobernanza: un cambio de prompt es un cambio de sistema y debe quedar registrado.
- **Registrar la decisión humana** sobre cada hallazgo (aceptado, corregido, rechazado), con actor y motivo.
- **Mantener el corpus de lecciones** (ADR-009): promover una corrección a criterio, congelarlo en versiones inmutables e inyectar las lecciones aplicables en los análisis siguientes. Es lo que hace que el sistema **mejore con el uso sin tocar el modelo**, conservando la reproducibilidad.
- Mantener el aislamiento multi-tenant en todo el recorrido: documento, extracción, inferencia y hallazgo.

### This component is NOT responsible for

- **Decidir el estado de cumplimiento de un requisito** — lo decide el auditor humano. Este componente solo propone. No existe transición autónoma de `Requirement.status`.
- **Almacenar el binario del documento** — es del Evidence Graph (`sourceRef`) sobre Vercel Blob.
- **Gestionar el ciclo de vida y la validación de la evidencia** (`draft → submitted → validated`) — es del Evidence Graph.
- **Evaluar reglas deterministas** (plazos, presencia de documentos obligatorios, formatos) — es del futuro Rule Engine. Ver conflicto de frontera arriba.
- **Detectar contradicciones entre evidencias** — es del futuro Contradiction Engine.
- **Estructurar el texto normativo de la ISO 19650** — es del futuro Knowledge Graph. Este slice trabaja contra el texto de `Requirement`.
- **Redactar el informe de auditoría** — es de `audit-report.generator.ts`.
- **Entrenar, afinar o evaluar modelos** — son Training Factory y Benchmark Framework. El aprendizaje que sí entra aquí (ADR-009) ocurre **en el contexto del prompt, nunca en los pesos**: el modelo sigue siendo intercambiable y sin estado.
- **El ciclo completo de mejora continua gobernada** — es CALS. Lo que se construye aquí es su germen y CALS deberá absorberlo, no duplicarlo (ADR-009 D6).
- **Analizar geometría o datos de modelo BIM/IFC** — fuera del slice inicial, que es documental. Ver Open Questions.

---

## Decisiones de encaje tomadas (2026-08-10)

| Decisión | Valor | Consecuencia |
|---|---|---|
| Componente anfitrión | Audit Intelligence Platform | La IA es capa gobernada, no motor de reglas. Requiere ADR-008 por la frontera con el Rule Engine |
| Base normativa del slice | Texto de los `Requirement` existentes (177 plantillas por rol) | Sin dependencia del Knowledge Graph y **sin riesgo de licencia**: son paráfrasis propias, no texto ISO. Se prevé campo opcional `knowledgeNodeId` para anclar a la cláusula real cuando exista |
| Extracción documental | Dentro de este componente | Evita un hueco entre dos specs; el Evidence Graph conserva su frontera actual intacta |

---

## Non-Functional Requirements

| Requirement | Target | Notes |
|------------|--------|-------|
| Multi-tenant isolation | Obligatorio | Extracción, inferencia y hallazgo resuelven tenant vía `Project`, igual que `EvidenceItem` |
| Audit trail | Obligatorio | `createdAt`/`updatedAt` + actor en toda entidad |
| Human-in-the-loop | Obligatorio | Ningún hallazgo modifica estado de auditoría sin decisión humana registrada |
| Provenance de inferencia | Obligatorio | Regla dura de `CLAUDE.md`: sin provenance registrada, una inferencia **no puede citarse en un informe** |
| Integridad normativa | Obligatorio | Prohibido generar cláusulas, criterios o evidencias. Toda cita debe ser literal y localizable en el documento fuente |
| Trazabilidad de la cita | Obligatorio | Todo hallazgo apunta a un fragmento concreto con su posición, no a "el documento" |
| Tiempo de respuesta | **Asíncrono, no < 2s** | Rompe con el patrón del resto de la app: un análisis tarda minutos. Ver Open Questions |
| Coste por análisis | A definir, con techo | Debe registrarse por inferencia y ser consultable por proyecto |
| Retención de la extracción | Sujeta a ADR-005 y ADR-007 | El texto extraído es una copia de documentación de cliente: mismo régimen jurisdiccional y mismo ciclo de purga |
| Encryption at rest | Vía Neon | Contenido extraído marcado como sensible en el domain model |

---

## Implementation Checklist

- [x] **ADR-008** — frontera Audit Intelligence Platform ↔ Rule Engine, proveedor/modelo, citación y ejecución asíncrona (`docs/adr/ADR-008-audit-intelligence-platform-frontera-y-proveedor.md`, Accepted)
- [x] **ADR-009** — aprendizaje gobernado por corpus de lecciones versionado (`docs/adr/ADR-009-aprendizaje-gobernado-por-corpus-de-lecciones.md`, Accepted)
- [x] Domain model documentado (`docs/domain-models/audit-intelligence-platform.md`) — 8 entidades, **27 invariantes**
- [x] API contract definido (`docs/api-contracts/audit-intelligence-platform.md`) — 14 endpoints; propagación al requisito **en bloque al cerrar el run** y vínculo con el Evidence Graph en el mismo gesto que la decisión (decisiones del usuario, 2026-08-10)
- [x] Security spec definido (`docs/security-specs/audit-intelligence-platform.md`) — ⚠️ **corrige el RBAC del api-contract**: decidir un hallazgo y cerrar un run son **admin-only**. Deja tres bloqueos abiertos: jurisdicción del proveedor, borrado en el proveedor (ADR-005) y control de gasto
- [ ] Migración Prisma escrita y aplicada
- [ ] Abstracción `AIProvider` implementada, sin SDK de proveedor en el dominio
- [ ] Capa de servicio (`services/extraction.service.ts`, `services/analysis.service.ts`)
- [ ] Route handlers implementados
- [ ] Checklist de compliance BAOS pasado (tenant scope, audit trail, RBAC, provenance)
- [ ] Test plan definido (`docs/test-plans/audit-intelligence-platform.md`)
- [ ] Tests, incluyendo aislamiento de tenant y verificación de que ninguna cita es inventada
- [ ] Smoke test añadido a `scripts/smoke-routes.mjs`
- [ ] Handoff actualizado en `docs/handoff.md`

**Prerrequisito externo bloqueante**: la **Fase D del Evidence Graph** (subida real a Blob). Sin documentos en el sistema este componente no tiene entrada.

---

## Open Questions

1. ~~**Ejecución asíncrona sobre Vercel**~~ ✅ **RESUELTO en ADR-008 (D4)**: Batches API + el cron de Vercel ya existente. Dato corregido: **Hobby admite 300 s por función** (defecto y máximo, con fluid compute), no un límite ajustado — un documento suelto cabe; un proyecto entero no.
2. **Formatos de entrada del slice inicial** — ADR-008 (D5) fija **PDF nativo** vía bloques `document` (límite de 32 MB por petición y 600 páginas). Siguen fuera y necesitan decisión propia: **PDF escaneado** sin capa de texto (requiere OCR) e **IFC/BIM** (no es texto, es modelo de datos).
3. ~~**Anclaje de la cita**~~ ✅ **RESUELTO en ADR-008 (D3)**: lo da la API. Con `citations: {enabled: true}`, cada cita trae el texto literal (`cited_text`) y su `page_location` con página inicial y final en base 1. ⚠️ **Coste asumido**: las citas son incompatibles con la salida estructurada por schema (`output_config.format` devuelve 400), así que el veredicto se extrae del texto con un parser estricto.
4. **Cómo se mide que la IA acierta** — el Benchmark Framework es futuro, pero sin una medida de acuerdo con el auditor humano no hay forma de saber si el componente aporta o estorba. Propuesta mínima, **ya asumida como mitigación de riesgo en ADR-008**: registrar la decisión humana sobre cada hallazgo (aceptado / corregido / rechazado) desde el primer día. Es corpus de evaluación gratuito.
5. **Techo de coste por auditoría** — decisión de producto, no técnica. ADR-008 fija el método (medir con `count_tokens` sobre documentos reales antes de comprometer un techo) pero no la cifra.
6. **Idioma de la documentación** — se asume español y se declara explícitamente; documentación en otros idiomas queda fuera del slice hasta decidirlo.
7. **Corrección pendiente en gobernanza aceptada** — `docs/domain-models/knowledge-graph.md` afirma que el texto normativo es de dominio público. Es incorrecto (ISO 19650 tiene copyright). No bloquea este slice, que no usa texto ISO, pero debe corregirse antes de implementar el Knowledge Graph.
8. **Jurisdicción del procesado de inferencia** — ADR-007 puso datos y cómputo en la UE. Queda por verificar dónde procesa el proveedor de inferencia y si eso exige alguna cláusula adicional. No lo resuelve ADR-008. ⚠️ **Elevado a bloqueante el 2026-08-10 por el security-spec**: no impide prototipar con datos propios, pero sí usar documentación real de cliente. Arrastra una consecuencia viva: sin política de borrado en el proveedor, el recibo sellado del ADR-005 afirmaría una purga que no ocurrió. ✅ La otra consecuencia —el store de Blob en `iad1`— **quedó resuelta el 2026-08-10**: `iso-saas-evidence-fra` está en `fra1` y el de Washington se borró vacío.
