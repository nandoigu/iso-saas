# API Contract: Audit Intelligence Platform

> BAOS Component: Audit Intelligence Platform
> Domain Model: `docs/domain-models/audit-intelligence-platform.md`
> ADRs: ADR-008 (frontera y proveedor), ADR-009 (aprendizaje gobernado), ADR-006 (semántica de snapshot), ADR-004 (convención `/api/admin/`)
> Security Spec: `docs/security-specs/audit-intelligence-platform.md` — ⚠️ **corrige el RBAC de dos endpoints de este contrato**; manda el security-spec
> Phase: Phase 1 Technological Foundation
> Date: 2026-08-10
> Status: Draft

## Summary

Esta API expone el ciclo completo del análisis IA de cumplimiento ISO 19650: componer un run sobre un proyecto, enviarlo al proveedor por lotes, reconciliar los resultados, presentar al auditor los hallazgos con sus citas verificables, registrar su decisión sobre cada uno y —solo al cerrar el run— propagar en bloque las conclusiones al estado de los requisitos. Incluye además la gestión del corpus de lecciones que hace que el sistema mejore con el uso sin tocar el modelo.

La consume el auditor desde la interfaz de proyecto, y un cron desde `/api/cron/*` para reconciliar lotes que tardan horas. El resultado de todo el ciclo es la capacidad central de BAOS: que una conclusión de auditoría sea reconstruible hasta el fragmento de PDF que la sostiene y hasta la llamada al modelo que la produjo.

---

## Convenciones aplicadas

⚠️ Este contrato sigue **los patrones reales del repositorio**, no la plantilla genérica de la skill. Diferencias verificadas en código:

| Aspecto | Plantilla de la skill | Realidad de este repo |
|---|---|---|
| Auth | `getAuthUser(request)` | **`getAuthSession(req, { allowBlocked: true })`** (`app/lib/auth.ts:144`) |
| Tenant | `companyId` en la query | **`userId`** — el scope real es `Project.userId`; `Company` existe pero no es el eje de aislamiento |
| Guard de admin | `user.role === 'admin'` | **`isAdminRole(user.role)`** |
| Bloqueo | no contemplado | `isBlockedStatus(user.status)` → `forbidden(BLOCKED_ACCOUNT_MESSAGE)` |
| Params de ruta | síncronos | **`params: Promise<{ id: string }>`** — Next.js 16, hay que hacer `await context.params` |

Patrón canónico de cabecera, idéntico al de `app/api/projects/[id]/route.ts:22-48`:

```typescript
const user = await getAuthSession(req, { allowBlocked: true });
if (!user) return unauthorized();
if (isBlockedStatus(user.status)) return forbidden(BLOCKED_ACCOUNT_MESSAGE);
```

**Scope de tenant en toda consulta de esta API.** El run cuelga del proyecto, y el proyecto del usuario:

```typescript
where: {
  id: runId,
  ...(isAdminRole(user.role) ? {} : { project: { userId: user.id } }),
}
```

Nunca se acepta `projectId` como prueba de propiedad: se acepta como entrada y se verifica contra la sesión. Si el registro no está en el ámbito del usuario, la respuesta es **404, no 403** — no se confirma la existencia de datos ajenos.

---

## Endpoints

Catorce endpoints en cinco grupos: ciclo del run, revisión humana, cierre, reconciliación, y gestión del corpus.

**Frontera de permiso**, fijada por el security-spec: componer, lanzar y **consultar** un análisis son actos del dueño del proyecto; **decidir un hallazgo y cerrar el run son admin-only**, porque fijan una conclusión de auditoría y crean vínculos de evidencia.

---

## Grupo 1 — Ciclo del run

### `POST /api/analysis-runs`

**Propósito**: crear un run en `draft`. No gasta dinero: solo compone qué se va a analizar. Existe como paso separado precisamente para que el auditor revise el alcance antes de lanzar un lote que cuesta.
**Auth**: requerida. **RBAC**: `user` (sobre sus proyectos) y `admin`.
**Scope**: `projectId` debe pertenecer al usuario.

#### Request Body

```typescript
type CreateRunRequest = {
  projectId: string;
  requirementIds?: string[];   // omitido = todos los requisitos del proyecto
  documentIds?: string[];      // AnalysisDocument.id; omitido = todos los "ready" del proyecto
  modelId?: string;            // por defecto "claude-opus-5" (ADR-008 D2)
};
```

#### Reglas de validación

- `projectId`: obligatorio, existente y dentro del ámbito del usuario.
- `requirementIds`: todos deben pertenecer a `projectId`. Uno solo fuera → 400, no se ignora en silencio.
- `documentIds`: todos con `status = "ready"` e `evidenceItem.projectId = projectId`. Un documento `unsupported` o `failed` → 400 con el `unsupportedReason` concreto (invariante #10). Un documento de otro proyecto → 404, es fuga de tenant (invariante #11).
- Al menos un requisito y al menos un documento. Un run sin documentos solo puede producir hallazgos por ausencia, que no es un análisis: es un formulario vacío.
- `modelId`: debe estar en la lista de modelos permitidos por configuración. No se acepta texto libre.
- `promptVersion` **no se acepta del cliente**: la fija el servidor desde la versión desplegada. Es identidad del sistema, no preferencia de usuario.

#### Response — 201 Created

```typescript
type AnalysisRunSummary = {
  id: string;
  projectId: string;
  status: "draft";
  modelId: string;
  promptVersion: string;
  requirementCount: number;
  documentCount: number;
  estimatedInputTokens: number | null;  // vía count_tokens; null si no se pudo estimar
  createdAt: string;
};
```

`estimatedInputTokens` es la única vía honesta de dar coste antes de gastar. Si la llamada a `count_tokens` falla, se devuelve `null` — **no se estima a ojo**.

#### Errores

| Status | Condición |
|---|---|
| 400 | Falta `projectId`, lista vacía, documento no `ready`, `modelId` no permitido |
| 401 | Sin sesión |
| 403 | Cuenta bloqueada |
| 404 | Proyecto, requisito o documento fuera del ámbito del usuario |

---

### `GET /api/analysis-runs`

**Propósito**: listar runs para la pantalla de proyecto y para el histórico de auditoría.
**Auth**: requerida. **Scope**: solo runs de proyectos del usuario; `admin` ve todos.

#### Query Parameters

| Param | Tipo | Req. | Descripción |
|---|---|---|---|
| `projectId` | `string` | No | Filtra por proyecto (validado contra la sesión) |
| `status` | `string` | No | Uno de los estados del run |
| `skip` | `number` | No | Offset, por defecto 0 |
| `take` | `number` | No | Máximo 100, por defecto 20 |

#### Response — 200 OK

```typescript
type ListRunsResponse = {
  data: (AnalysisRunSummary & {
    submittedAt: string | null;
    completedAt: string | null;
    closedAt: string | null;
    findingCount: number;
    pendingDecisionCount: number;  // hallazgos aún en "proposed"
  })[];
  total: number;
};
```

`pendingDecisionCount` es el dato operativo que necesita el auditor: cuánto le queda por revisar antes de poder cerrar.

---

### `GET /api/analysis-runs/[id]`

**Propósito**: detalle y progreso del run, con el desglose que la interfaz necesita mientras se espera.
**Auth**: requerida. **Scope**: vía `project.userId`.

#### Response — 200 OK

```typescript
type GetRunResponse = {
  id: string;
  projectId: string;
  projectName: string;
  status: "draft" | "submitted" | "processing" | "completed"
        | "closed" | "failed" | "expired" | "cancelled";
  modelId: string;
  promptVersion: string;
  lessonSetVersion: number | null;
  requirementCount: number;
  findingCount: number;
  progress: {
    proposed: number;
    accepted: number;
    corrected: number;
    rejected: number;
  };
  classificationBreakdown: Record<FindingClassification, number>;
  submittedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  closedAt: string | null;
  closedBy: { id: string; name: string | null } | null;
  propagatedCount: number;
  failureReason: string | null;
  cost: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    costMicroUsd: number;    // microdólares enteros — sin coma flotante en dinero
  };
  createdAt: string;
};
```

El bloque `cost` se agrega desde `AiInference`. Es el instrumento con el que se responde a la pregunta abierta del coste real por auditoría, que hoy no tiene cifra.

#### Errores

| Status | Condición |
|---|---|
| 401 / 403 | Sin sesión / cuenta bloqueada |
| 404 | Run inexistente o fuera del ámbito |

---

### `POST /api/analysis-runs/[id]/submit`

**Propósito**: enviar el run al proveedor mediante la Batches API (ADR-008 D4). Es el punto en que se gasta dinero y en que la identidad del sistema queda congelada.
**Auth**: requerida. **RBAC**: el propietario del proyecto o `admin`.

#### Request Body

Vacío. Todo lo que determina el resultado ya está en el run — enviarlo no admite parámetros, porque un parámetro de última hora sería un cambio de sistema no registrado.

#### Efectos (en una transacción)

1. `status: "draft" → "submitted"`, `submittedAt = now()`.
2. **`lessonSetVersion` se fija al `LessonSet` activo** y ya no cambia, aunque el lote tarde horas (ADR-009 D2, invariante #20).
3. Se construye una petición por requisito, correlacionada por `custom_id` — los resultados de un lote **llegan en cualquier orden**.
4. Se guarda `providerBatchId` y `expiresAt`.

⚠️ **Restricción de implementación derivada de la provenance.** `AiInference.modelVersion` es no-nulo y solo se conoce al llegar la respuesta, así que la fila de provenance se escribe en la reconciliación, no aquí. Para que `inputDigest` siga siendo el hash del payload realmente enviado, **el constructor del payload debe ser una función pura de (run, requisito, snapshot del LessonSet)**, reproducible en la reconciliación sin almacenar el payload completo. Si alguna vez deja de serlo, hay que persistir el digest en el submit.

#### Response — 200 OK

```typescript
type SubmitRunResponse = {
  id: string;
  status: "submitted";
  providerBatchId: string;
  lessonSetVersion: number | null;
  requestCount: number;
  submittedAt: string;
  expiresAt: string | null;
};
```

#### Errores

| Status | Condición |
|---|---|
| 409 | El run no está en `draft` — enviar dos veces duplicaría el gasto |
| 422 | Un documento pasó a no disponible entre la creación y el envío |
| 502 | El proveedor rechazó el lote; `failureReason` queda persistido |

---

### `POST /api/analysis-runs/[id]/cancel`

**Propósito**: abandonar un run antes de que produzca conclusiones.
**Auth**: requerida. **RBAC**: propietario o `admin`.

Solo desde `draft`, `submitted` o `processing`. Un run con hallazgos ya decididos **no se cancela** (invariante #9): retirarlo va por el ciclo de cierre del ADR-005.

#### Response — 200 OK

```typescript
type CancelRunResponse = { id: string; status: "cancelled"; cancelledAt: string };
```

| Status | Condición |
|---|---|
| 409 | Run en `completed`, `closed`, o con hallazgos en `accepted`/`corrected` |

---

## Grupo 2 — Revisión humana

### `GET /api/analysis-runs/[id]/findings`

**Propósito**: la pantalla de revisión. Devuelve cada propuesta con las citas que la sostienen, para que el auditor pueda verificarla contra el PDF sin salir de la aplicación.
**Auth**: requerida. **Scope**: vía `run.project.userId`.

#### Query Parameters

| Param | Tipo | Descripción |
|---|---|---|
| `status` | `string` | `proposed` \| `accepted` \| `corrected` \| `rejected` |
| `classification` | `string` | Filtra por `proposedClassification` |
| `basis` | `string` | `cited` \| `absence` — aísla los hallazgos por ausencia, que se revisan distinto |
| `confidence` | `string` | `high` \| `medium` \| `low` — permite atacar primero lo dudoso |
| `skip` / `take` | `number` | Paginación; `take` máximo 100, por defecto 50 |

#### Response — 200 OK

```typescript
type FindingWithCitations = {
  id: string;
  requirement: {
    id: string;
    norma: string | null;
    item: string | null;
    name: string;
    status: string;          // estado ACTUAL del requisito, aún sin propagar
  };
  proposedClassification: FindingClassification;
  basis: "cited" | "absence";
  confidence: "high" | "medium" | "low";
  rationale: string;
  status: "proposed" | "accepted" | "corrected" | "rejected";
  finalClassification: FindingClassification | null;
  requiresCorrectiveAction: boolean;
  citations: {
    id: string;
    citedText: string;       // VERBATIM — no normalizar al serializar (invariante #7)
    startPage: number;       // base 1
    endPage: number;
    document: { id: string; evidenceItemId: string; title: string };
  }[];
  latestDecision: {
    outcome: "accepted" | "corrected" | "rejected";
    decidedClassification: FindingClassification;
    notes: string;
    decidedAt: string;
    decidedBy: { id: string; name: string | null };
  } | null;
  createdAt: string;
};

type ListFindingsResponse = { data: FindingWithCitations[]; total: number };
```

⚠️ `citedText` viaja **verbatim**. Ninguna capa de serialización puede recortarlo ni normalizar sus espacios: toda su utilidad depende de que coincida literalmente con el PDF.

Se incluye `requirement.status` a propósito: el auditor tiene que ver qué estado tiene hoy el requisito frente a lo que la IA propone, porque el cambio no se aplicará hasta el cierre.

---

### `GET /api/findings/[id]`

**Propósito**: un hallazgo con su historial completo de decisiones.
**Auth**: requerida. **Scope**: vía `analysisRun.project.userId`.

#### Response — 200 OK

```typescript
type GetFindingResponse = FindingWithCitations & {
  decisions: {                // acumuladas, más reciente primero
    id: string;
    outcome: "accepted" | "corrected" | "rejected";
    decidedClassification: FindingClassification;
    notes: string;
    decidedAt: string;
    decidedBy: { id: string; name: string | null };
  }[];
  appliedLessons: {           // lecciones inyectadas en ESTE análisis
    id: string;
    lessonText: string;
    lessonSetVersion: number;
  }[];
  hasProvenance: boolean;
};
```

`appliedLessons` se reconstruye desde el snapshot de `LessonSet` de la versión que el run fijó, no desde el corpus actual. Es lo que permite explicar por qué el sistema dijo lo que dijo **entonces**.

`hasProvenance: false` es una anomalía operativa que la interfaz debe mostrar: un hallazgo sin provenance no puede citarse en un informe (invariante #6).

---

### `POST /api/admin/findings/[id]/decisions`

**Propósito**: el punto de control humano. Registra la decisión del auditor y, opcionalmente y en el mismo gesto, promueve una lección y crea el vínculo de evidencia.
**Auth**: requerida. **RBAC**: ⚠️ **solo `admin`**.

> **Corregido el 2026-08-10 por el security-spec.** La primera versión de este contrato lo abría al dueño del proyecto. Es incompatible con la gobernanza ya aceptada por dos motivos: crea un `EvidenceRequirementLink`, que es **admin-only** en el Evidence Graph —dejarlo abierto sería una puerta trasera al mismo efecto sin el mismo permiso—, y fija una conclusión de auditoría, que es la clase de acto que el precedente del Evidence Graph reserva a `admin`. La ruta se mueve bajo `/api/admin/` por la convención de ADR-004 #2.

#### Request Body

```typescript
type CreateDecisionRequest = {
  outcome: "accepted" | "corrected" | "rejected";
  decidedClassification: FindingClassification;
  notes?: string;               // OBLIGATORIO si outcome !== "accepted"

  // Promoción de lección (ADR-009 D5) — solo con corrected o rejected
  lesson?: {
    lessonText: string;
  };

  // Vínculo con el Evidence Graph — solo con accepted o corrected
  evidenceLink?: {
    citationId: string;         // qué cita sostiene el vínculo
  };
};
```

#### Reglas de validación

**De la decisión:**
- `outcome = "accepted"` exige `decidedClassification === finding.proposedClassification`. Aceptar y a la vez cambiar la clasificación es `corrected`, no `accepted` — si no, el corpus de aprendizaje se contamina con «aceptaciones» que en realidad eran correcciones.
- `notes` no vacías si `outcome` es `corrected` o `rejected` (invariante #13).
- Un run en `closed` no admite decisiones nuevas (invariante #26) → 409.

**De la lección** (se comprueba **antes** de guardar, y un fallo aborta la operación entera):
- Solo con `outcome` de `corrected` o `rejected` (invariante #16).
- `lessonText` no idéntico a `notes` (invariante #17). Es el control que obliga a que sanear sea un acto y no una intención.
- `lessonText` no contiene el `citedText` de ninguna cita del hallazgo, ni el nombre del proyecto, ni el de la empresa de origen (invariante #18).
- ⚠️ Estas comprobaciones detectan la **copia literal, no la paráfrasis**. El riesgo residual está aceptado en ADR-009 D4 y **no debe presentarse en la interfaz como una garantía de anonimización**.
- Promover crea un `LessonSet` nuevo (invariante #19). La lección entra en vigor de inmediato y aplica **a todos los clientes** — la interfaz debe decirlo con esas palabras antes de confirmar.

**Del vínculo de evidencia:**
- Solo con `outcome` de `accepted` o `corrected`. Un hallazgo rechazado no crea vínculo: su cita no sostiene nada.
- `citationId` debe pertenecer al hallazgo.
- Se crea `EvidenceRequirementLink { evidenceItemId: citation.document.evidenceItemId, requirementId: finding.requirementId, linkType: "primary", addedBy: user.id }`.
- **Si el par ya existe, no se pisa** (`@@unique([evidenceItemId, requirementId])`): se conserva el vínculo previo con su `linkType` y se devuelve `evidenceLink.created = false`.

#### Efectos (una transacción)

1. Inserta `FindingDecision` — acumulativa, nunca sobrescribe una anterior.
2. Desnormaliza en `AnalysisFinding`: `status`, `finalClassification`, y `requiresCorrectiveAction` derivado de la clasificación final y **congelado** (invariante #4).
3. Si procede, crea `AuditLesson` + `LessonSet` nuevo.
4. Si procede, crea `EvidenceRequirementLink`.
5. **No toca `Requirement.status`** (invariante #5). Eso solo ocurre al cerrar.

#### Response — 201 Created

```typescript
type CreateDecisionResponse = {
  finding: {
    id: string;
    status: "accepted" | "corrected" | "rejected";
    finalClassification: FindingClassification;
    requiresCorrectiveAction: boolean;
  };
  lesson: { id: string; lessonSetVersion: number } | null;
  evidenceLink: { id: string; created: boolean } | null;
  runProgress: { pendingDecisionCount: number; canClose: boolean };
};
```

`runProgress.canClose` evita que la interfaz tenga que recalcular si ya se puede cerrar.

#### Errores

| Status | Condición |
|---|---|
| 400 | `notes` vacías en `corrected`/`rejected`; clasificación inválida; `accepted` con clasificación distinta a la propuesta |
| 409 | Run cerrado; lección promovida desde una decisión `accepted` |
| 422 | La lección no supera la sanitización — el error indica **qué** control falló, sin repetir el dato sensible |

---

### `GET /api/findings/[id]/provenance`

**Propósito**: reconstruir una conclusión ante un tercero. Es el Explainability Framework hecho endpoint.
**Auth**: requerida. **RBAC**: propietario o `admin`.

#### Response — 200 OK

```typescript
type ProvenanceResponse = {
  findingId: string;
  inferences: {
    id: string;
    modelId: string;          // solicitado
    modelVersion: string;     // el que el proveedor declaró servir — puede diferir
    promptVersion: string;
    lessonSetVersion: number | null;
    inputDigest: string;
    inputRef: unknown;        // providerFileIds, requirementId, ids de bloque
    parameters: unknown;      // temperatura, max_tokens, formato
    rawOutput: unknown;       // lo que el modelo devolvió antes de interpretarlo
    stopReason: string | null;
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    costMicroUsd: number;
    latencyMs: number;
    occurredAt: string;
  }[];
};
```

Devuelve las ocho piezas que exige la regla de provenance de `CLAUDE.md`. `rawOutput` viaja sin interpretar a propósito: es la diferencia entre «lo dijo la IA» y «el modelo X versión Y devolvió exactamente esto».

⚠️ **`stopReason: "refusal"`** debe distinguirse en la interfaz de un hallazgo normal: el modelo se negó a responder, no concluyó nada.

---

## Grupo 3 — Cierre y propagación

### `POST /api/admin/analysis-runs/[id]/close`

**Propósito**: el único momento en que las conclusiones del análisis llegan al estado de los requisitos. Decisión del usuario del 2026-08-10: **en bloque, no hallazgo a hallazgo**.
**Auth**: requerida. **RBAC**: ⚠️ **solo `admin`** — corregido el 2026-08-10 por el security-spec. Es la única ruta de todo el componente que escribe `Requirement.status`.

#### Request Body

```typescript
type CloseRunRequest = {
  confirm: true;   // confirmación explícita: la operación es irreversible
};
```

#### Precondiciones

- `status = "completed"`. Un run que falló o caducó no se cierra.
- **Cero hallazgos en `proposed`** (invariante #24). Si quedan, 409 con la cuenta exacta.
- `closedAt` nulo — cerrar dos veces no es idempotente, es un intento de reabrir.

#### Efectos (una única transacción, invariante #25)

Para cada hallazgo decidido:

| `finalClassification` | `Requirement.status` resultante |
|---|---|
| `conforme` | `conforme` |
| `no_conformidad_mayor` | `no_conforme` |
| `no_conformidad_menor` | `no_conforme` |
| `observacion` | `parcial` |
| `oportunidad_mejora` | `conforme` |
| *(hallazgo `rejected`)* | **sin cambio** |

Y sobre el run: `status = "closed"`, `closedAt`, `closedBy`, `propagatedCount`.

`propagatedCount` cuenta los requisitos **que cambiaron de estado**, no los procesados: un requisito ya `conforme` que recibe un hallazgo `conforme` no cuenta.

No hay estado intermedio observable. O propaga entero o no propaga nada — es lo que impide que un informe generado a media revisión mezcle la auditoría anterior con la actual.

#### Response — 200 OK

```typescript
type CloseRunResponse = {
  id: string;
  status: "closed";
  closedAt: string;
  propagatedCount: number;
  breakdown: {
    conforme: number;
    parcial: number;
    no_conforme: number;
    unchanged: number;       // rechazados + los que ya estaban en ese estado
  };
};
```

#### Errores

| Status | Condición |
|---|---|
| 400 | Falta `confirm: true` |
| 409 | Run no `completed`; hallazgos sin decidir (con la cuenta); run ya cerrado |

> **Nota de alcance.** Cerrar el run **no genera** el informe de auditoría ni el plan de acción correctiva. `AuditReportNonConformity` (`services/audit-report.types.ts:55`) no tiene campo de severidad y `oportunidad_mejora` no cabe en un array llamado `nonConformities`. Conectar la taxonomía con el módulo de informes es trabajo aparte, ya señalado en el domain model.

---

## Grupo 4 — Reconciliación

### `GET /api/cron/analysis-reconcile`

**Propósito**: los lotes tardan hasta 24 h; alguien tiene que recoger los resultados. Sigue el patrón ya existente en `/api/cron/alerts`.
**Auth**: **`Authorization: Bearer ${CRON_SECRET}`** — no sesión de usuario. Réplica exacta de `isAuthorizedCronRequest` (`app/api/cron/alerts/route.ts:340`).

#### Comportamiento

Para cada run en `submitted` o `processing`:

1. Consulta el estado del lote por `providerBatchId`.
2. Correlaciona cada resultado por `custom_id` — **llegan en cualquier orden**.
3. Por cada resultado: crea `AnalysisFinding`, sus `FindingCitation` y **la fila `AiInference`** con `modelVersion`, `rawOutput`, tokens, coste y latencia.
4. `status → "completed"` solo cuando **no queda ninguna petición sin resultado** (invariante #14). Si el lote caducó, `expired`, nunca `completed`.

#### Validación de cada resultado antes de persistir

- Un hallazgo `conforme` sin cita se rechaza (invariante #2): la conformidad no se concluye del vacío.
- `basis = "cited"` exige ≥1 cita; `basis = "absence"` exige exactamente 0 (invariante #1).
- Toda cita debe apuntar a un `AnalysisDocument` del mismo proyecto que el run (invariante #11). Una cita cruzada **no es un error de datos, es una fuga de tenant**: se descarta y se registra como incidencia.
- `startPage >= 1` y `endPage >= startPage` (invariante #8).

Un resultado que no supera la validación no se persiste como hallazgo. Su `AiInference` **sí** se persiste: el gasto ocurrió y debe quedar registrado.

#### Response — 200 OK

```typescript
type ReconcileResponse = {
  runsChecked: number;
  runsCompleted: number;
  runsExpired: number;
  findingsCreated: number;
  resultsRejected: number;    // fallaron validación de invariantes
  errors: { runId: string; reason: string }[];
};
```

| Status | Condición |
|---|---|
| 401 | Falta o no coincide el `Bearer` |

Registrar en `vercel.json` junto al cron de alertas. Cada ejecución debe caber en **300 s** (límite de Vercel Hobby, defecto y máximo — ADR-008 D4): si hay más runs de los que caben, se procesan por antigüedad y el resto espera al siguiente disparo.

---

## Grupo 5 — Corpus de lecciones (admin)

Promover es acto del auditor y ocurre dentro de `POST /api/findings/[id]/decisions`. **Retirar es acto de admin** (invariante #22), y vive aquí.

### `GET /api/admin/audit-lessons`

**Auth**: requerida. **RBAC**: **solo `admin`** → `if (!isAdminRole(user.role)) return forbidden()`.

Sin scope de tenant: las lecciones son globales por decisión del usuario (ADR-009 D4). Es la primera excepción deliberada al aislamiento multi-tenant en BAOS, y por eso el endpoint es exclusivo de admin.

#### Query Parameters

| Param | Tipo | Descripción |
|---|---|---|
| `scopeKey` | `string` | Identidad del requisito: `templateId` o `"norma\|item"` |
| `status` | `string` | `active` \| `retired` |
| `originCompanyId` | `string` | Auditar de qué cliente salió cada criterio |

#### Response — 200 OK

```typescript
type ListLessonsResponse = {
  data: {
    id: string;
    scopeKey: string;
    lessonText: string;
    status: "active" | "retired";
    origin: {
      companyId: string | null;
      companyName: string | null;
      decisionId: string | null;
      requirementTemplateId: string | null;
    };
    createdBy: { id: string; name: string | null };
    createdAt: string;
    retiredAt: string | null;
    retiredReason: string | null;
    usageCount: number;   // runs que la llevaban en su LessonSet
  }[];
  total: number;
  activeLessonSetVersion: number;
};
```

`usageCount` es lo que permite medir el daño de una lección equivocada antes de retirarla.

---

### `POST /api/admin/audit-lessons/[id]/retire`

**Propósito**: sacar del corpus un criterio equivocado o superado.
**Auth**: requerida. **RBAC**: solo `admin`.

#### Request Body

```typescript
type RetireLessonRequest = {
  reason: string;   // obligatorio, no vacío
};
```

#### Efectos

`status → "retired"`, `retiredBy`, `retiredAt`, `retiredReason`, y **un `LessonSet` nuevo** con el corpus resultante (invariante #19).

**Retirar no reescribe el pasado** (invariante #21): los hallazgos producidos con versiones anteriores conservan su `lessonSetVersion` y siguen siendo reconstruibles.

#### Response — 200 OK

```typescript
type RetireLessonResponse = {
  id: string;
  status: "retired";
  newLessonSetVersion: number;
  affectedFindings: {
    count: number;
    runIds: string[];   // runs producidos con esta lección activa
  };
};
```

`affectedFindings` responde a la pregunta que importa después de retirar un criterio equivocado: **a qué conclusiones ya emitidas afectó**. Devolverlo aquí evita que alguien tenga que reconstruirlo a mano justo cuando más prisa hay.

| Status | Condición |
|---|---|
| 400 | `reason` vacío |
| 403 | No admin |
| 409 | La lección ya está retirada |

---

### `GET /api/admin/lesson-sets/[version]`

**Propósito**: recuperar el corpus exacto vigente en un momento dado. Es la pieza que cierra la explicabilidad: sin ella, `lessonSetVersion` sería un número sin contenido.
**Auth**: requerida. **RBAC**: solo `admin`.

#### Response — 200 OK

```typescript
type GetLessonSetResponse = {
  version: number;
  snapshot: {              // inmutable — ADR-006: el snapshot N describe el estado EN N
    lessons: { id: string; scopeKey: string; lessonText: string }[];
  };
  lessonCount: number;
  changeReason: string;
  triggeredBy: { id: string; name: string | null };
  createdAt: string;
};
```

| Status | Condición |
|---|---|
| 404 | Versión inexistente |

---

## TypeScript Types (canónicos)

```typescript
// services/audit-intelligence.types.ts

/** Taxonomía aportada por el usuario. Fuente autorizada — no reinventar. */
export type FindingClassification =
  | "conforme"
  | "no_conformidad_mayor"
  | "no_conformidad_menor"
  | "observacion"
  | "oportunidad_mejora";

export type FindingBasis = "cited" | "absence";
export type FindingConfidence = "high" | "medium" | "low";
export type FindingStatus = "proposed" | "accepted" | "corrected" | "rejected";
export type DecisionOutcome = "accepted" | "corrected" | "rejected";

export type AnalysisRunStatus =
  | "draft" | "submitted" | "processing" | "completed"
  | "closed" | "failed" | "expired" | "cancelled";

/** Estado del requisito — vocabulario YA EXISTENTE, 88 usos en código. Eje distinto. */
export type RequirementStatus = "conforme" | "parcial" | "no_conforme" | "pendiente";

/**
 * Correspondencia entre los dos ejes. CONFIRMADA por el usuario el 2026-08-10.
 * Se aplica ÚNICAMENTE al cerrar el run. Un hallazgo "rejected" no propaga.
 * `observacion → parcial` es criterio expreso: "parcial es más objetivo que menor".
 * `oportunidad_mejora → conforme` porque la OM presupone conformidad.
 */
export const CLASSIFICATION_TO_REQUIREMENT_STATUS: Record<
  FindingClassification,
  RequirementStatus
> = {
  conforme: "conforme",
  no_conformidad_mayor: "no_conforme",
  no_conformidad_menor: "no_conforme",
  observacion: "parcial",
  oportunidad_mejora: "conforme",
};

/** Obligación de plan correctivo. Se DERIVA al decidir y se CONGELA (invariante #4). */
export const REQUIRES_CORRECTIVE_ACTION: Record<FindingClassification, boolean> = {
  conforme: false,
  no_conformidad_mayor: true,
  no_conformidad_menor: true,
  observacion: false,
  oportunidad_mejora: false,
};
```

---

## BAOS Compliance Checklist

- [x] **Sesión válida en todos los endpoints** — `getAuthSession`; la única excepción es el cron, autenticado por `CRON_SECRET` igual que `/api/cron/alerts`.
- [x] **Scope de tenant en toda consulta** — vía `project.userId`, nunca desde el body. 404 en vez de 403 al salirse del ámbito.
- [x] **Endpoints de admin comprobados** — `isAdminRole` en los cinco bajo `/api/admin/`: decisión, cierre y los tres del corpus.
- [x] **Mutaciones auditables versionadas** — `FindingDecision` acumulativa; alta o retirada de lección crea `LessonSet` nuevo.
- [x] **Sin transición autónoma de estado** — ninguna ruta escribe `Requirement.status` salvo `close`, que exige `confirm` explícito de un humano identificado.
- [x] **Errores sin filtración** — `{ error: string }`; el error de sanitización dice qué control falló, no repite el dato sensible.
- [x] **Operaciones en bloque con filtro por registro** — `close` valida cada hallazgo dentro de la transacción, no solo la propiedad del run.
- [~] **Aislamiento multi-tenant** — excepción deliberada y acotada: el grupo 5 opera sobre un corpus global (ADR-009 D4). Mitigado con acceso exclusivo de admin, procedencia registrada y sanitización verificada. ⚠️ Riesgo residual de paráfrasis aceptado.

---

## Service Layer

```
app/api/analysis-runs/route.ts                     → POST, GET
app/api/analysis-runs/[id]/route.ts                → GET
app/api/analysis-runs/[id]/submit/route.ts         → POST
app/api/analysis-runs/[id]/cancel/route.ts         → POST
app/api/analysis-runs/[id]/findings/route.ts       → GET
app/api/findings/[id]/route.ts                     → GET
app/api/findings/[id]/provenance/route.ts          → GET
app/api/admin/analysis-runs/[id]/close/route.ts    → POST   (admin-only)
app/api/admin/findings/[id]/decisions/route.ts     → POST   (admin-only)
app/api/cron/analysis-reconcile/route.ts           → GET
app/api/admin/audit-lessons/route.ts               → GET
app/api/admin/audit-lessons/[id]/retire/route.ts   → POST
app/api/admin/lesson-sets/[version]/route.ts       → GET

services/analysis-run.service.ts        Ciclo de vida del run, submit, cierre transaccional
services/analysis-finding.service.ts    Decisiones, derivación y congelado de requiresCorrectiveAction
services/audit-lesson.service.ts        Promoción, sanitización, retirada, versionado de LessonSet
services/ai-provider.ts                 Abstracción AIProvider — ÚNICO punto que importa el SDK
services/audit-intelligence.types.ts    Tipos compartidos
```

⚠️ **`services/ai-provider.ts` es el único módulo del repositorio autorizado a importar el SDK de Anthropic.** Es la regla de no acoplamiento a proveedor de `CLAUDE.md`, hecha límite de fichero para que sea verificable con un grep, no una intención.

Los route handlers no llevan lógica de negocio: autenticar, validar, llamar al servicio, formatear.

---

## Integration Notes

**Modelos Prisma que toca**: `AnalysisRun`, `AnalysisFinding`, `FindingCitation`, `FindingDecision`, `AiInference`, `AuditLesson`, `LessonSet`, `AnalysisDocument` (lectura), `Requirement` (escritura **solo** en `close`), `EvidenceRequirementLink` (escritura), `EvidenceItem` (lectura), `Project` (scope), `User` (actores).

**Depende de**:
- **Fase D del Evidence Graph** — subida real a Vercel Blob. Sin documentos en el sistema no hay `AnalysisDocument`, y sin `AnalysisDocument` esta API no tiene entrada. **Es el prerrequisito duro de todo el componente.**
- **Vercel Cron** — una entrada nueva en `vercel.json` junto a la de alertas.
- **`ANTHROPIC_API_KEY`** — variable de entorno nueva, aún no existe en el proyecto.

**Bloquea a**:
- La interfaz de revisión de hallazgos, que no existe.
- La pantalla de gestión de lecciones, que no existe.
- La conexión con el módulo de informes, que requiere cambiar `AuditReportContent`.

⚠️ **`DELETE /api/projects/[id]` debe extenderse en la misma migración.** Gana dos bloqueos: `AnalysisRun → Project` (`Restrict`) y `AnalysisFinding → Requirement` (`Restrict`). **El segundo falla en un paso intermedio**, no en la clave foránea del proyecto: el handler borra los requisitos a mano antes que el proyecto. Es el mismo defecto ya corregido con `AuditTeam` y `EvidenceItem` en `c14b26b`.

---

## Open Questions

1. **Techo de gasto por run.** `estimatedInputTokens` informa, pero nada impide lanzar un run carísimo. ¿Bloqueo duro por importe, aviso, o límite por proyecto? Requiere primero una cifra real medida con `count_tokens` sobre documentos de verdad, que todavía no se ha hecho.
2. **Reintento parcial.** Si tres de doscientas peticiones del lote fallan, hoy el run entero queda `completed` con menos hallazgos de los esperados. ¿Se permite un run de reintento que complete los huecos, o se re-analiza todo? Afecta a la invariante #12.
3. **Concurrencia en el cierre.** Dos auditores con el proyecto abierto pueden pulsar cerrar a la vez. Se resuelve con un bloqueo optimista sobre `closedAt` en la transacción, pero conviene decidir qué ve el segundo: 409, o el resultado del primero.
4. **`linkType = "primary"`.** Decidido por defecto porque la cita es la base textual directa de la conclusión. Si se prefiere `"supporting"`, es cambiar una constante en `analysis-finding.service.ts`.
5. **Visibilidad del corpus para el auditor.** Hoy solo el admin lista lecciones, pero el auditor las ve aplicadas en `appliedLessons` de un hallazgo. ¿Debería poder consultar el corpus completo de un requisito antes de decidir?
