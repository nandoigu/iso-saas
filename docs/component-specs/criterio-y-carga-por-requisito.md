# Component Spec: Criterio de aceptación y carga de evidencia por requisito

> BAOS Component: Requirement Graph (criterio) + Evidence Graph (carga)
> Module: Prerrequisitos de la Audit Intelligence Platform
> Phase: Phase 1 — Technological Foundation
> Date: 2026-09-03
> Status: Draft

---

## Strategic Purpose

El objetivo del proyecto es que la IA actúe como auditor. Este componente no la construye: retira las dos cosas que hoy se lo impiden.

1. **El rasero.** Sin criterio de aceptación, el modelo solo tiene el enunciado del requisito y la taxonomía. Sabe leer el documento y sabe qué pregunta responder, pero nadie le ha dicho qué es una respuesta buena (ADR-013). Ese criterio es contenido normativo: solo puede escribirlo el experto.
2. **El rutado.** Sin el vínculo documento→requisito, el análisis tendría que enfrentar cada documento a los 38 requisitos del rol. Medido el 2026-09-02 sobre un manual BIM real de 1,35 MB: 167.420 tokens con rutado frente a 6.101.850 sin él, un 97,3 % de diferencia.

Ninguna de las dos es una funcionalidad para el usuario final. Son la condición de entrada del componente que sí lo es.

---

## Architectural Position

| Attribute | Value |
|-----------|-------|
| BAOS layer | Knowledge |
| Implementation phase | Phase 1 Foundation |
| Entry point | `app/lib/requirementImport.ts`, `services/template.service.ts` (criterio); `app/api/projects/[id]/evidence/*`, `app/api/projects/[id]/requirements/[requirementId]/evidence-links` (carga) |
| Persistence | `RequirementTemplate.criterioAceptacion` (ya migrado, sin uso); `EvidenceItem`, `EvidenceRequirementLink` (ya existen); `AnalysisDocument` (nueva) |
| Boundary | Produce el criterio y el vínculo. NO evalúa el cumplimiento, no llama a ningún modelo y no escribe `Requirement.status`. |

---

## Estado medido (2026-09-03)

Verificado en el repositorio, no heredado de notas anteriores:

| Hecho | Comprobación |
|---|---|
| 91 plantillas: 38 adjudicador · 35 adjudicatario principal · 18 adjudicatario | `app/lib/defaultRequirementTemplates.ts` |
| La quinta columna «Criterio de Aceptación» existe en los tres Excel de `docs/fuentes/` | cabeceras de los tres libros |
| Está vacía: una sola celda ocupada por hoja, la propia cabecera | celdas de la columna E: 1, 1, 1 |
| `criterioAceptacion` está en el schema y **no lo lee ni lo escribe nadie** | `grep` sin resultados fuera de `prisma/` |
| La quinta columna no rompe la importación actual | `hasRoleHeaders` comprueba presencia de 4 columnas, no conjunto exacto (`app/lib/requirementImport.ts:410`) |
| El vínculo declarado por el dueño ya tiene backend | `declareEvidenceRequirementLink`, ruta bajo el requisito |
| No hay UI para nada de lo anterior | `find app -name page.tsx` |

---

## Functional Scope

### This component IS responsible for

- Leer la quinta columna del Excel de rol y persistirla en `RequirementTemplate.criterioAceptacion`.
- Exponer el criterio en el listado de requisitos **leyéndolo de la plantilla por la relación**, nunca copiándolo: es global, y copiarlo dejaría versiones obsoletas en cada proyecto cuando el experto lo corrija (ADR-013 D2).
- Ofrecer, en cada requisito de un proyecto, un botón de carga que en un solo gesto: sube el fichero al store, crea el `EvidenceItem`, declara el `EvidenceRequirementLink` y crea el `AnalysisDocument`.
- Mostrar al dueño qué documentos ha presentado ya para cada requisito.

### This component is NOT responsible for

- Valorar. Ninguna clasificación de la taxonomía se emite aquí.
- Llamar a ningún modelo. No hay provenance, ni corpus de lecciones, ni coste de inferencia.
- Validar el vínculo. Sigue siendo del auditor y sigue bajo `/api/admin/` (ADR-010).
- Escribir el contenido de los criterios. Es doctrina del experto y está prohibido generarla con IA (ADR-013, regla de integridad normativa de `CLAUDE.md`).

---

## Decisiones tomadas en esta sesión (2026-09-03)

Todas del responsable de producto, salvo indicación:

1. **La carga vive en un panel lateral** que se abre desde cada requisito, no en una ruta propia ni desplegada en la fila. Cumple el gesto que ADR-010 fijó y mantiene fuera de `ProjectClient.tsx` —64 KB— todo el estado de subida.
2. **El auditor no rechaza evidencia: la valora.** Corrección expresa del responsable de producto. Se retira del diseño todo botón de rechazo. ADR-010 ya lo decía: un documento equivocado no se retira, produce una no conformidad.
3. **Los veredictos humanos y los de la IA viven en las mismas tablas.** Un solo sitio donde mirar cuando la IA empiece a producirlos.
4. **La IA es el objetivo principal y va antes que la pantalla de revisión.** Consecuencia directa: el modo «valorar desde cero» no se construye nunca, porque cuando exista la pantalla del auditor ya habrá propuestas que revisar. Con él desaparece la necesidad de un `AnalysisRun` sin modelo y de un `confidence` anulable.
5. **El criterio es una sola columna** con los cuatro apartados de ADR-013 D3 dentro. No se toca el schema ya migrado.

---

## Contenido de cada criterio (ADR-013 D3)

Cuatro apartados dentro de la misma celda, escritos por el experto con sus palabras, nunca copiando texto de la norma (copyright de ISO y AENOR):

1. Qué documento o documentos lo satisfacen.
2. Qué debe encontrarse dentro: lo concreto y verificable, que es lo que después se podrá citar.
3. Qué **no** basta: fallos típicos, el documento correcto pero incompleto, la mención genérica sin desarrollo.
4. Dónde está la frontera entre no conformidad **mayor** y **menor** en ese requisito concreto.

El cuarto es el de mayor rendimiento: la IA propone la severidad y hoy no tiene con qué decidirla más allá de la definición genérica de la taxonomía.

---

## Cómo nace `AnalysisDocument`

Se crea en la misma transacción que el `EvidenceItem`, no más tarde y no en un proceso aparte. El motivo es que sus campos obligatorios —`mediaType` y `sizeBytes`— los conoce el navegador en el momento de la subida y no están en `EvidenceItem`, que solo guarda `sourceRef`. Recuperarlos después obligaría a interrogar al store fichero a fichero.

`pageCount` queda **nulo**, tal como el domain model lo tiene diseñado («null hasta que se inspecciona»), y `status` arranca en `pending`. Los rellena la fase de la IA cuando prepare el documento para análisis.

Efecto secundario buscado: cuando llegue el componente de IA, su tabla de entrada ya está poblada sin trabajo de migración de datos.

---

## Non-Functional Requirements

| Requisito | Cómo se cumple |
|---|---|
| Jurisdicción UE | Nada nuevo sale del perímetro: no hay llamadas a proveedor en este componente (ADR-007) |
| El binario no atraviesa la función | La subida usa el token de cliente que ya existe (`upload-token`, ADR-004 #3) |
| Aislamiento por proyecto | `assertProjectAccess` antes de conceder escritura; `AnalysisDocument` resuelve tenant por `evidenceItem → project` |
| RBAC | Declarar es del dueño; validar sigue siendo admin. No se abre ninguna ruta admin (ADR-010) |
| Importación no regresiva | La quinta columna se ignora en los formatos que no la traen; los tres Excel actuales siguen importando igual |

---

## Implementation Checklist

- [ ] Ampliar `getRoleTemplateColumnMap` y el parser para leer «Criterio de Aceptación»
- [ ] Persistir el criterio en `importTemplates`
- [ ] Exponer el criterio por la relacion `Requirement.template`, **sin copiarlo** al requisito
- [ ] Preparar los tres Excel de trabajo con la columna E estructurada en los cuatro apartados
- [ ] Migración aditiva: `AnalysisDocument`
- [ ] Crear `AnalysisDocument` en el mismo gesto que el `EvidenceItem`
- [ ] Componente de panel lateral, aislado de `ProjectClient.tsx`
- [ ] Botón y contador de documentos por requisito
- [ ] Tests: importacion con y sin quinta columna, y gesto de carga completo
- [x] Que la declaracion no exige admin — **ya cubierto** por el bloque `DECL` de `tests/api/evidence.test.ts:1045`

---

## Open Questions

- El contenido de los 91 criterios lo escribe el responsable de producto. Se arranca por **adjudicador (38)**, que es un rol completo y suficiente para el primer análisis.
- ADR-013 D6 deja abierta la forma exacta del snapshot del criterio —campo en `AiInference` o en el `AnalysisRun`—. Se decide en la fase de la IA, no aquí.
