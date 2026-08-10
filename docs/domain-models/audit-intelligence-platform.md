# Domain Model: Audit Intelligence Platform

> BAOS Component: Audit Intelligence Platform
> Module: Análisis de cumplimiento documental (Document Compliance Analysis)
> Phase: Slice inicial sobre Phase 1 Foundation
> Date: 2026-08-10
> Status: Draft

---

## Conceptual Model

Seis entidades sostienen el bucle completo: preparar un documento, lanzar un análisis, proponer un veredicto, respaldarlo con citas verificables, dejar que un humano decida, y poder reconstruir después cómo se produjo todo.

**AnalysisDocument** es un documento de evidencia listo para analizar. No guarda el texto del documento: guarda la referencia con la que el proveedor de IA lo lee, más los datos que deciden si el documento es analizable (número de páginas, tipo, tamaño). Un PDF escaneado sin capa de texto queda marcado como no soportado y no entra en ningún análisis, en lugar de producir un resultado silenciosamente pobre.

**AnalysisRun** es una campaña de análisis sobre un proyecto: qué requisitos se van a evaluar, contra qué documentos, con qué modelo y con qué versión de prompt. Como un análisis tarda minutos y se ejecuta por lotes, el run es también la máquina de estados que sabe si el lote está enviado, en proceso, terminado, caducado o fallido. Es la entidad que el usuario ve mientras espera.

**AnalysisFinding** es lo que el sistema propone para **un requisito** dentro de un run: una clasificación propuesta según la taxonomía de auditoría (ver sección siguiente), un nivel de confianza y una justificación en lenguaje natural. Es una propuesta, nunca un veredicto: sus campos de propuesta son inmutables una vez escritos, y la clasificación que cuenta es la que fija el auditor.

**FindingCitation** es el fragmento concreto del documento que sostiene la propuesta: el **texto literal** que la API extrajo del documento y las páginas donde aparece. Es la pieza que hace verificable todo el sistema: un revisor abre el PDF por esa página y comprueba que el texto está ahí. Un hallazgo que afirme cumplimiento o incumplimiento sin ninguna cita es una violación de evidence-first, no un caso límite.

**FindingDecision** es la decisión humana sobre un hallazgo: aceptarlo, corregirlo o rechazarlo, con quién lo hizo, cuándo y por qué. Se acumulan —igual que `EvidenceValidation` en el Evidence Graph—, de modo que si un auditor cambia de criterio queda registrado el cambio, no solo el resultado final. Este registro cumple dos funciones a la vez: es el punto de control humano y es el corpus con el que algún día se medirá si la IA acierta.

**AiInference** es el registro de provenance de cada llamada al modelo: qué modelo, qué versión, qué versión de prompt, sobre qué entradas, con qué parámetros, cuándo, qué devolvió en crudo, cuántos tokens costó y cuánto tardó. Es lo que permite responder, meses después y ante un tercero, cómo se produjo exactamente una conclusión. Sin esta fila, su hallazgo no puede citarse en un informe.

---

## Taxonomía de clasificación de hallazgos

Aportada por el usuario el 2026-08-10 como **fuente autorizada del proyecto**, conforme a la regla de integridad normativa de `CLAUDE.md`. No es una invención del sistema ni una paráfrasis: es el vocabulario de auditoría con el que se trabaja.

| Clasificación | Valor en base de datos | Qué significa | ¿Exige plan de acción correctiva? |
|---|---|---|---|
| **CONFORME** | `conforme` | El requisito se observa | No |
| **NO CONFORMIDAD MAYOR** | `no_conformidad_mayor` | Incumplimiento **grave** del requerimiento de la norma | **Sí** |
| **NO CONFORMIDAD MENOR** | `no_conformidad_menor` | Incumplimiento **no grave** | **Sí** |
| **OBSERVACIÓN** | `observacion` | Incumplimiento menor **fácilmente subsanable** | No |
| **OPORTUNIDAD DE MEJORA** | `oportunidad_mejora` | Sugerencia para mejorar el grado de cumplimiento. **No es un incumplimiento** | No |

Tres consecuencias de diseño que se derivan de esta tabla:

1. **La clasificación no es el estado del requisito.** El sistema ya tiene un vocabulario para el estado (`conforme` · `parcial` · `no_conforme` · `pendiente`, 88 usos en código). Son dos ejes: uno describe **en qué estado está el requisito**, el otro **qué hallazgo se levanta sobre él**. Se relacionan por la tabla de propagación de más abajo, no se funden.
2. **`oportunidad_mejora` no es una no conformidad.** Agruparla con las demás en un array llamado `nonConformities` sería incorrecto de cara a un auditor externo. Afecta al informe (ver Integration).
3. **La obligación de plan correctivo se persiste, no se recalcula.** Se deriva de la clasificación aceptada en el momento de decidir y queda inmutable, por el mismo motivo que ADR-006 fija el snapshot al estado resultante: si mañana cambia la política, los hallazgos históricos deben conservar la obligación que tenían cuando se levantaron.

**Quién clasifica**: la IA propone la clasificación completa —incluida la severidad— con su justificación y sus citas; el auditor confirma o corrige. La clasificación que produce efectos es siempre la del humano.

---

## Entities and Responsibilities

| Entity | What it represents | Key attributes |
|--------|-------------------|----------------|
| `AnalysisDocument` | Documento de evidencia preparado para análisis | `evidenceItemId`, `providerFileId`, `pageCount`, `mediaType`, `sizeBytes`, `status`, `unsupportedReason` |
| `AnalysisRun` | Campaña de análisis sobre un proyecto | `projectId`, `status`, `modelId`, `promptVersion`, `providerBatchId`, `requestedBy`, contadores |
| `AnalysisFinding` | Propuesta de clasificación para un requisito | `analysisRunId`, `requirementId`, `proposedClassification`, `basis`, `confidence`, `rationale`, `status`, `finalClassification`, `requiresCorrectiveAction` |
| `FindingCitation` | Fragmento literal que sostiene la propuesta | `analysisFindingId`, `analysisDocumentId`, `citedText`, `startPage`, `endPage` |
| `FindingDecision` | Decisión humana sobre un hallazgo | `analysisFindingId`, `outcome`, `decidedClassification`, `notes`, `decidedBy` |
| `AiInference` | Provenance completa de una llamada al modelo | `analysisRunId`, `analysisFindingId`, `modelId`, `modelVersion`, `promptVersion`, `inputDigest`, `parameters`, `rawOutput`, tokens, coste, latencia |

---

## Entity Relationships

```
Project (1) ─────── (N) AnalysisRun
                          │
        ┌─────────────────┼─────────────────┐
        │                                   │
   (N) AnalysisFinding              (N) AiInference
        │   │                               │
        │   └── (1) Requirement             └── (0..1) AnalysisFinding
        │                                        [SetNull: la provenance
        ├── (N) FindingCitation                   sobrevive al hallazgo]
        │        │
        │        └── (1) AnalysisDocument ─── (1) EvidenceItem ─── (1) Project
        │
        └── (N) FindingDecision ─── (1) User

Cadena de trazabilidad completa:
  Requirement ← AnalysisFinding → FindingCitation → AnalysisDocument → EvidenceItem
                      ↑                                    (texto literal + página)
                 AiInference
              (cómo se produjo)
```

**Cardinalidades:**

- `Project` → `AnalysisRun`: 1-a-N
- `AnalysisRun` → `AnalysisFinding`: 1-a-N (uno por requisito evaluado)
- `AnalysisFinding` → `Requirement`: N-a-1 (un requisito puede evaluarse en varios runs)
- `AnalysisFinding` → `FindingCitation`: 1-a-N
- `FindingCitation` → `AnalysisDocument`: N-a-1
- `AnalysisDocument` → `EvidenceItem`: 1-a-1 (único por evidencia)
- `AnalysisFinding` → `FindingDecision`: 1-a-N (acumulativo, no sustitutivo)
- `AnalysisRun` → `AiInference`: 1-a-N
- `AiInference` → `AnalysisFinding`: N-a-0..1

---

## Prisma Schema

```prisma
// ─────────────────────────────────────────────────────────────────────────────
// AUDIT INTELLIGENCE PLATFORM — Documento preparado para análisis
// No almacena el contenido: el PDF viaja nativo a la API (ADR-008 D5).
// ─────────────────────────────────────────────────────────────────────────────

model AnalysisDocument {
  id                String   @id @default(cuid())
  evidenceItemId    String   @unique // tenant isolation via evidenceItem → project → company
  providerFileId    String? // referencia del fichero en el proveedor de IA (Files API)
  providerExpiresAt DateTime? // si el proveedor caduca la referencia, hay que re-subir
  mediaType         String // "application/pdf" | ...
  pageCount         Int? // null hasta que se inspecciona
  sizeBytes         Int
  status            String   @default("pending") // "pending" | "ready" | "unsupported" | "failed"
  unsupportedReason String? // "scanned_no_text_layer" | "exceeds_page_limit" | "exceeds_size_limit" | "unsupported_media_type"
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  createdBy         String // userId

  evidenceItem EvidenceItem      @relation(fields: [evidenceItemId], references: [id], onDelete: Restrict)
  creator      User              @relation("AnalysisDocumentCreator", fields: [createdBy], references: [id], onDelete: Restrict)
  citations    FindingCitation[]

  @@index([status])
  @@index([createdBy])
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT INTELLIGENCE PLATFORM — Campaña de análisis (máquina de estados del lote)
// ─────────────────────────────────────────────────────────────────────────────

model AnalysisRun {
  id              String    @id @default(cuid())
  projectId       String // tenant isolation via project → company
  status          String    @default("draft") // "draft" | "submitted" | "processing" | "completed" | "failed" | "expired" | "cancelled"
  modelId         String // p. ej. "claude-opus-5" — solicitado; el servido se registra en AiInference
  promptVersion   String // versión del prompt: un cambio de prompt es un cambio de sistema
  providerBatchId String? // identificador del lote en el proveedor
  submittedAt     DateTime?
  completedAt     DateTime?
  expiresAt       DateTime? // el lote caduca en el proveedor; hay que reconciliar antes
  failureReason   String?
  requirementCount Int      @default(0) // requisitos incluidos en el run
  findingCount    Int       @default(0) // hallazgos efectivamente producidos
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  requestedBy     String // userId

  project   Project           @relation(fields: [projectId], references: [id], onDelete: Restrict)
  requester User              @relation("AnalysisRunRequester", fields: [requestedBy], references: [id], onDelete: Restrict)
  findings  AnalysisFinding[]
  inferences AiInference[]

  @@index([projectId])
  @@index([status])
  @@index([providerBatchId])
  @@index([requestedBy])
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT INTELLIGENCE PLATFORM — Propuesta por requisito (append-only)
// Los campos de propuesta son inmutables. La decisión vive en FindingDecision.
// ─────────────────────────────────────────────────────────────────────────────

model AnalysisFinding {
  id            String @id @default(cuid())
  analysisRunId String
  requirementId String

  // ── Propuesta del sistema: INMUTABLE tras crearse ──
  proposedClassification String // "conforme" | "no_conformidad_mayor" | "no_conformidad_menor" | "observacion" | "oportunidad_mejora"
  basis                  String // "cited" | "absence" — sobre qué se sostiene la propuesta
  confidence             String // "high" | "medium" | "low" — enumerado, no número: no hay calibración que respalde una probabilidad
  rationale              String // justificación en lenguaje natural, tal como la devolvió el modelo

  // ── Estado de decisión: desnormalizado de la FindingDecision más reciente ──
  status                   String  @default("proposed") // "proposed" | "accepted" | "corrected" | "rejected"
  finalClassification      String? // clasificación que fija el auditor; null mientras status = "proposed"
  requiresCorrectiveAction Boolean @default(false) // derivado de finalClassification al decidir; luego inmutable

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  analysisRun AnalysisRun       @relation(fields: [analysisRunId], references: [id], onDelete: Cascade)
  requirement Requirement       @relation(fields: [requirementId], references: [id], onDelete: Restrict)
  citations   FindingCitation[]
  decisions   FindingDecision[]
  inferences  AiInference[]

  @@unique([analysisRunId, requirementId])
  @@index([analysisRunId])
  @@index([requirementId])
  @@index([status])
  @@index([finalClassification])
  @@index([requiresCorrectiveAction])
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT INTELLIGENCE PLATFORM — Cita verificable (ADR-008 D3)
// citedText lo produce la API sobre el documento, no lo redacta el modelo.
// ─────────────────────────────────────────────────────────────────────────────

model FindingCitation {
  id                 String   @id @default(cuid())
  analysisFindingId  String
  analysisDocumentId String
  citedText          String // VERBATIM. No se normaliza, recorta ni reescribe: su valor es la coincidencia literal
  startPage          Int // base 1, como devuelve la API
  endPage            Int // base 1
  documentIndex      Int // posición del documento en la petición, para reconstruir la llamada
  createdAt          DateTime @default(now())

  analysisFinding  AnalysisFinding  @relation(fields: [analysisFindingId], references: [id], onDelete: Cascade)
  analysisDocument AnalysisDocument @relation(fields: [analysisDocumentId], references: [id], onDelete: Restrict)

  @@index([analysisFindingId])
  @@index([analysisDocumentId])
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT INTELLIGENCE PLATFORM — Decisión humana (patrón EvidenceValidation)
// Acumulativa: un cambio de criterio se registra, no se sobrescribe.
// ─────────────────────────────────────────────────────────────────────────────

model FindingDecision {
  id                    String   @id @default(cuid())
  analysisFindingId     String
  outcome               String // "accepted" | "corrected" | "rejected"
  decidedClassification String // clasificación que el auditor fija; en "accepted" coincide con proposedClassification
  notes                 String   @default("") // obligatorio en "corrected" y "rejected" — ver invariante #13
  decidedAt             DateTime @default(now())
  decidedBy             String // userId — NUNCA null: es el punto de control humano

  analysisFinding AnalysisFinding @relation(fields: [analysisFindingId], references: [id], onDelete: Cascade)
  decider         User            @relation("FindingDecider", fields: [decidedBy], references: [id], onDelete: Restrict)

  @@index([analysisFindingId])
  @@index([decidedBy])
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT INTELLIGENCE PLATFORM — Provenance de inferencia (regla dura de CLAUDE.md)
// Sin esta fila, su hallazgo no puede citarse en un informe de auditoría.
// ─────────────────────────────────────────────────────────────────────────────

model AiInference {
  id                String   @id @default(cuid())
  analysisRunId     String
  analysisFindingId String? // null en operaciones de run que no producen hallazgo

  // Identidad del sistema que produjo el resultado
  modelId       String // solicitado, p. ej. "claude-opus-5"
  modelVersion  String // el que el proveedor declara haber servido — puede diferir del solicitado
  promptVersion String // el mismo modelo con otro prompt es, a efectos de auditoría, otro sistema

  // Reproducibilidad de la entrada
  inputDigest   String // hash del payload exacto enviado (documentos + requisito + instrucciones)
  inputRef      Json // referencias estables: providerFileId(s), requirementId, ids de bloque
  parameters    Json // temperatura, effort, max_tokens, formato — lo que afecte al resultado

  // Salida y economía
  rawOutput     Json // lo que el modelo devolvió, antes de interpretarlo
  stopReason    String? // "end_turn" | "max_tokens" | "refusal" | ...
  inputTokens   Int      @default(0)
  outputTokens  Int      @default(0)
  cachedTokens  Int      @default(0)
  costMicroUsd  Int      @default(0) // microdólares enteros: sin coma flotante en dinero
  latencyMs     Int      @default(0)

  occurredAt DateTime @default(now())

  analysisRun     AnalysisRun      @relation(fields: [analysisRunId], references: [id], onDelete: Cascade)
  analysisFinding AnalysisFinding? @relation(fields: [analysisFindingId], references: [id], onDelete: SetNull)

  @@index([analysisRunId])
  @@index([analysisFindingId])
  @@index([modelId])
  @@index([occurredAt])
}
```

### Back-relations a añadir en modelos existentes

```prisma
// model User { ... }
  analysisDocumentsCreated AnalysisDocument[] @relation("AnalysisDocumentCreator")
  analysisRunsRequested    AnalysisRun[]      @relation("AnalysisRunRequester")
  findingDecisions         FindingDecision[]  @relation("FindingDecider")

// model Project { ... }
  analysisRuns AnalysisRun[]

// model Requirement { ... }
  analysisFindings AnalysisFinding[]

// model EvidenceItem { ... }
  analysisDocument AnalysisDocument?
```

---

## BAOS Compliance Checklist

- [x] **Aislamiento multi-tenant** — ninguna entidad lleva `tenantId` propio, igual que el Evidence Graph: la cadena es resoluble en todos los casos. `AnalysisRun → Project → Company/User`; `AnalysisDocument → EvidenceItem → Project`; `AnalysisFinding → AnalysisRun → Project`. La invariante #11 prohíbe además citas cruzadas entre proyectos.
- [x] **Audit trail** — `createdAt`/`updatedAt` en las entidades mutables; `occurredAt` en `AiInference` y `decidedAt` en `FindingDecision`, que son inmutables por diseño.
- [x] **Actor de gobernanza** — `createdBy` en `AnalysisDocument`, `requestedBy` en `AnalysisRun`, `decidedBy` en `FindingDecision`. `AnalysisFinding` y `AiInference` **no llevan actor humano a propósito**: los produce el sistema, y atribuirlos a una persona sería falsificar el trail. Su actor es el registro de provenance.
- [x] **Reglas de borrado explícitas en todas las relaciones** — ver tabla en Integration.
- [x] **Evidence-first** — toda conclusión enlaza con su fuente por FK tipada (`FindingCitation → AnalysisDocument → EvidenceItem`), nunca por JSON opaco. Las invariantes #1 y #2 prohíben afirmar cumplimiento sin cita, y admiten la ausencia documentada como base explícita de un incumplimiento.
- [x] **Sin mutación sin registro** — `AnalysisFinding` es **append-only** en sus campos de propuesta, que es una garantía más fuerte que versionar: no hay nada que versionar porque nada se edita. Las decisiones se acumulan en `FindingDecision`. No se añade tabla de versiones, y ADR-006 no aplica por no existir entidad versionada aquí.
- [x] **Human-in-the-loop** — `FindingDecision.decidedBy` nunca es null. Ningún campo permite transición autónoma: la invariante #5 prohíbe explícitamente que el sistema escriba `Requirement.status`. La severidad la propone la IA pero solo produce efectos cuando un humano la fija en `finalClassification`.
- [x] **Campos sensibles documentados** — ver abajo.

### Campos sensibles

| Campo | Por qué | Régimen |
|---|---|---|
| `FindingCitation.citedText` | **Contiene texto literal de documentación de cliente.** Es el campo más sensible del modelo | Jurisdicción ADR-007; purga ADR-005 |
| `AiInference.rawOutput` | Puede contener fragmentos del documento analizado | Ídem |
| `AiInference.inputRef` / `inputDigest` | Referencias y hash de la entrada; el digest no revela contenido, las referencias sí lo localizan | Ídem |
| `AnalysisDocument.providerFileId` | Identificador en un servicio externo; permite recuperar el documento | Rotar/revocar al purgar |

---

## Invariants and Business Rules

1. **Sin cita no hay afirmación, salvo que la afirmación sea la ausencia.** Un `AnalysisFinding` con `basis = "cited"` debe tener al menos una `FindingCitation`. Un hallazgo con `basis = "absence"` debe tener **cero** citas y una `rationale` que declare qué se buscó y dónde — es el caso legítimo de «la documentación no aborda este requisito», donde por definición no hay texto que citar. Es evidence-first aplicado al análisis, sin obligar a inventar una cita cuando lo relevante es que no existe.
2. **La conformidad nunca se concluye del vacío.** `proposedClassification = "conforme"` exige `basis = "cited"`. Que un documento no diga lo contrario no demuestra que el requisito se cumpla; solo una cita puede sostener una conformidad.
3. **Sin humano no hay decisión.** `AnalysisFinding.status` solo abandona `proposed` mediante una `FindingDecision` con `decidedBy` no nulo. `finalClassification` es null mientras el hallazgo siga en `proposed`, y después refleja siempre la decisión más reciente.
4. **La obligación de plan correctivo se deriva y se congela.** Al registrar una decisión, `requiresCorrectiveAction` se calcula desde `finalClassification` —cierto para `no_conformidad_mayor` y `no_conformidad_menor`, falso para las otras tres— y no se vuelve a recalcular. Un cambio futuro de política no reescribe hallazgos históricos.
5. **El sistema nunca escribe `Requirement.status`.** Propagar una decisión al requisito es una acción explícita y separada del auditor. Ninguna ruta de código del análisis puede modificar ese campo.
6. **Sin provenance no hay cita en informe.** Todo `AnalysisFinding` procede de al menos una `AiInference` con `modelId`, `modelVersion`, `promptVersion`, `inputDigest` y `parameters` no vacíos. Un hallazgo sin ella no puede vincularse a un `AuditReport`.
7. **`citedText` es verbatim.** Se persiste exactamente como lo devuelve la API: sin normalizar espacios, sin recortar, sin reescribir. Toda su utilidad depende de que coincida literalmente con el documento.
8. **Páginas coherentes.** `startPage >= 1` y `endPage >= startPage`. Base 1, como la API.
9. **Un run con resultados aceptados no se borra.** Un `AnalysisRun` con hallazgos en `accepted` o `corrected` solo puede archivarse; retirarlo va por el ciclo de cierre del ADR-005.
10. **Documento no soportado no entra.** Un `AnalysisDocument` con `status` distinto de `ready` no puede aparecer en las citas de un run. Un PDF escaneado se rechaza antes de gastar una inferencia.
11. **Las citas no cruzan proyecto.** Toda `FindingCitation` debe apuntar a un `AnalysisDocument` cuyo `EvidenceItem.projectId` coincida con el `AnalysisRun.projectId`. Una cita cruzada es una fuga de tenant, no un error de datos.
12. **Un requisito, un hallazgo por run.** Garantizado por `@@unique([analysisRunId, requirementId])`. Re-analizar exige un run nuevo, que deja el anterior intacto como histórico.
13. **Corregir y rechazar exigen motivo.** Una `FindingDecision` con `outcome` de `corrected` o `rejected` debe llevar `notes` no vacías. Aceptar no lo exige; apartarse de la propuesta, sí — y ese texto es además el corpus con el que se medirá dónde falla el modelo.
14. **`completed` significa terminado.** Un `AnalysisRun` no pasa a `completed` mientras queden peticiones del lote sin resultado. Si el lote caduca, el estado es `expired`, no `completed`.
15. **Propuesta inmutable.** `proposedClassification`, `basis`, `confidence`, `rationale` y las citas no se modifican tras crearse. Corregir es decidir, y eso vive en `FindingDecision`.

---

## Integration with Existing Schema

**Es puramente aditivo.** Seis tablas nuevas, ninguna columna modificada en tablas existentes. Solo se añaden back-relations en `User`, `Project`, `Requirement` y `EvidenceItem`, que en Prisma no generan SQL sobre las tablas existentes.

### Reglas de borrado

| Relación | Regla | Motivo |
|---|---|---|
| `AnalysisDocument.evidenceItem` | **Restrict** | Un documento analizado no desaparece por borrar la evidencia; el servicio lo retira explícitamente cuando es seguro |
| `AnalysisRun.project` | **Restrict** | Un proyecto con historial de análisis se retira por el ciclo de cierre (ADR-005), no por borrado ordinario |
| `AnalysisFinding.analysisRun` | Cascade | El hallazgo pertenece al run |
| `AnalysisFinding.requirement` | **Restrict** | Un hallazgo es una conclusión de auditoría; no puede evaporarse al borrar el requisito |
| `FindingCitation.analysisFinding` | Cascade | La cita pertenece al hallazgo |
| `FindingCitation.analysisDocument` | **Restrict** | Protege el destino de la cita: sin documento, la cita deja de ser verificable |
| `FindingDecision.analysisFinding` | Cascade | La decisión pertenece al hallazgo |
| `AiInference.analysisRun` | Cascade | La provenance vive con el run; su retención la gobierna ADR-005 |
| `AiInference.analysisFinding` | **SetNull** | La provenance sobrevive a la desaparición de su hallazgo |
| Todas las relaciones de actor (`User`) | **Restrict** | Igual que en Audit Team y Evidence Graph: no se borra un usuario que dejó rastro de gobernanza |

### ⚠️ `DELETE /api/projects/[id]` gana dos bloqueos nuevos

El handler ya devuelve 409 nombrando qué bloquea, con campo `blockedBy` (commit `c14b26b`). Este modelo añade dos causas más:

- **`AnalysisRun`** con `onDelete: Restrict` sobre `Project` — bloquea directamente.
- **`AnalysisFinding`** con `onDelete: Restrict` sobre `Requirement` — bloquea **indirectamente**: el handler borra los requisitos a mano antes de borrar el proyecto, y ese borrado fallará si hay hallazgos.

El segundo es el peligroso, porque el fallo aparece en un paso intermedio y no en la FK del proyecto. **El handler debe extenderse en la misma migración**, siguiendo el patrón ya establecido: recuento dentro de la transacción y 409 nombrando el bloqueo. Es exactamente el defecto que ya se corrigió una vez con `AuditTeam` y `EvidenceItem`; repetirlo sería no haber aprendido.

### Relación con el Evidence Graph

`AnalysisDocument` extiende `EvidenceItem` sin tocarlo: relación 1-a-1 opcional desde la evidencia. La frontera se mantiene tal como la fijó su spec — el Evidence Graph posee el ciclo de vida y la referencia al fichero; este componente posee su preparación para análisis y todo lo derivado.

Un hallazgo aceptado es candidato natural a generar un `EvidenceRequirementLink`, pero **esa conexión no se implementa aquí**: crearlo es una acción del auditor sobre el Evidence Graph, no un efecto automático del análisis. Anotado como pregunta abierta.

### ⚠️ El módulo de informes necesita la taxonomía, y su estructura actual no la admite

`AuditReportNonConformity` (`services/audit-report.types.ts:55`) tiene cuatro campos —`requirementId`, `itemCode`, `status`, `reason`— y **no tiene clasificación de severidad**. Se construye automáticamente filtrando la matriz de auditoría por estados de incumplimiento (`buildNonConformitiesFromAuditMatrix`, `services/audit-report.service.ts:309`), y el `reason` es texto libre que hoy se teclea a mano.

Dos consecuencias, ninguna resuelta en este modelo:

1. **El informe no puede distinguir una no conformidad mayor de una menor.** Es exactamente la distinción que un auditor certificador necesita ver primero. Incorporar la taxonomía al informe es un cambio en `AuditReportContent`, que va versionado en `AuditReportVersion` — hay que planificar la compatibilidad con los informes ya generados.
2. **`oportunidad_mejora` no cabe en un array llamado `nonConformities`.** No es un incumplimiento. Meterla ahí sería incorrecto ante un tercero. El informe ya tiene secciones separadas de «Observaciones» y «Debilidades y oportunidades de mejora» en las exportaciones PDF y DOCX (`audit-report.pdf.ts:58-59`, `audit-report.docx.ts:46-50`), así que el destino natural existe; falta conectarlo.

Queda **fuera del alcance de este componente** y anotado como trabajo del módulo de informes.

### Knowledge Graph

No se añade `Requirement.knowledgeNodeId`. ADR-008 lo prevé como campo opcional futuro; introducirlo ahora sería adelantar un componente de Phase 3 sin necesidad.

---

## Open Questions

1. **Propagación al `Requirement`.** La invariante #5 prohíbe que el sistema escriba `Requirement.status`; falta definir cómo lo hace el auditor (acción por hallazgo o aceptación en bloque al cerrar el run). Afecta al api-contract, no al schema. La **correspondencia entre los dos ejes** es propuesta mía y necesita confirmación antes de implementarse:

   | `finalClassification` | `Requirement.status` propuesto |
   |---|---|
   | `conforme` | `conforme` |
   | `no_conformidad_mayor` | `no_conforme` |
   | `no_conformidad_menor` | `no_conforme` |
   | `observacion` | `parcial` |
   | `oportunidad_mejora` | **no cambia** — es una sugerencia, no un incumplimiento |

   El punto discutible es `observacion → parcial`: la taxonomía la define como incumplimiento menor fácilmente subsanable, y `parcial` es el valor existente que más se le acerca, pero no es una equivalencia exacta.
2. **Hallazgo aceptado → `EvidenceRequirementLink`.** ¿Debe el auditor poder crear el vínculo de evidencia desde el hallazgo en un solo gesto? Sería el punto donde el análisis alimenta de verdad al Evidence Graph.
3. **Caducidad de `providerFileId`.** El modelo prevé `providerExpiresAt`, pero falta decidir la política: re-subir bajo demanda al lanzar un run, o mantener un proceso de refresco. Depende de la política real de retención del proveedor, que hay que verificar.
4. **Granularidad del run.** Hoy un run cubre un proyecto entero. ¿Hace falta un run parcial —unos pocos requisitos, un documento nuevo— sin re-analizar todo? El schema lo admite (`requirementCount` es un contador, no una restricción); la decisión es de producto.
5. **`confidence` como enumerado.** Se elige `high|medium|low` en lugar de un número porque no existe calibración que respalde una probabilidad, y un `0.87` invita a leerse como precisión que no hay. Reconsiderable cuando el Benchmark Framework aporte datos reales.
6. **Deriva respecto al component-spec.** El spec dice que este componente «extrae el contenido textual y estructural [...] y lo persiste como proyección legible por máquina». ADR-008 (D5) lo supera: el PDF viaja nativo y las citas las produce la API, así que **no se persiste el texto extraído**. `AnalysisDocument` guarda referencia y metadatos, no contenido. El spec debe corregirse para que ambos documentos digan lo mismo.
