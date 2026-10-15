# Component Spec: Documentación de justificación por proyecto

> BAOS Component: Evidence Graph
> Module: Catálogo de plantillas documentales y justificación por proyecto
> Phase: Phase 1 — Technological Foundation
> Date: 2026-10-13
> Status: Draft
> Diseño de origen: `docs/superpowers/specs/2026-10-12-documentacion-justificacion-design.md` (decisiones D1-D14 del usuario, no se reabren)

Este spec cubre **la entrega 1 (catálogo visible)** con detalle. La entrega 2 (justificación) se describe solo en su frontera; sus cuestiones abiertas viven en ADR-016.

---

## Strategic Purpose

Un proyecto auditado bajo ISO 19650 tiene que producir una serie de documentos de gestión de la información, que varía según su rol y su fase. Hoy BAOS no le dice cuáles son ni le da con qué hacerlos. Este módulo convierte las plantillas de elaboración propia de Eficax en un **catálogo gobernado**: cada proyecto ve qué documentos le corresponden, descarga la plantilla vigente y, en la entrega 2, sube el resultado como evidencia trazable que el auditor valora y la IA analiza.

---

## Architectural Position

| Attribute | Value |
|-----------|-------|
| BAOS layer | Knowledge (catálogo) + Evidence Graph (justificación, entrega 2) |
| Implementation phase | Phase 1 Foundation |
| Entry point | `services/document-template.service.ts`, `app/lib/documentTemplateImport.ts`, rutas bajo `app/api/projects/[id]/document-templates/` y una ruta admin de importación |
| Persistence | `DocumentTemplate` (nueva, global) y su vínculo con `RequirementTemplate`. En la entrega 2, `EvidenceItem.documentTemplateId` (anulable) |
| Boundary | Cataloga plantillas y las sirve. NO valora documentos, no evalúa cumplimiento ni escribe `Requirement.status` |

---

## Estado medido (2026-10-13)

| Hecho | Comprobación |
|---|---|
| El libro tiene 23 filas con Fichero, Formato, Nombre, Vigente, Rol, Fase, Obligatoria, Tipo y Requisitos completos (23/23) | lectura de `docs/fuentes/trabajo/plantillas_documentales.xlsx`, guardado a las 13:05 |
| Los 23 ficheros existen en `docs/fuentes/plantillas-iso/` (28 ficheros, 5,3 MB) | cruce fichero a fichero |
| 5 ficheros no tienen fila: Manual BIM (excluido por el usuario) y 4 versiones descartadas | mismo cruce |
| `RequirementTemplate.norma` se guarda como `19650-1` / `19650-2`, sin «ISO» | Excel de `docs/fuentes/` |
| Las referencias del libro vienen como `ISO 19650-2/5.3.1;5.6.3, 5.6.5`: prefijo «ISO», norma solo en la primera y separador `;` o `,` | lectura del libro |
| Todas las referencias resuelven para al menos un rol de su fila: **47 vínculos plantilla-requisito**, ninguna referencia huérfana (tras corregir el usuario la fila 22 el 13-oct, guardado a las 13:31) | cruce con la hoja «Requisitos (consulta)» |
| `next.config.js` ya usa `outputFileTracingIncludes` (para `pdfkit`) | lectura del fichero |
| No hay pantalla que llame a `/api/import-templates` | `grep` en `app/` y `components/` |

---

## Dependency Map

### Upstream

| Dependency | Type | What it provides |
|-----------|------|-----------------|
| `RequirementTemplate` | Prisma | Destino de las referencias «Requisitos que justifica», resueltas por `(rol, norma, item)` |
| `Project.role` | Prisma | Qué plantillas aplican al proyecto |
| `getAuthSession`, `isAdminRole` (`app/lib/auth.ts`) | Interno | Sesión y RBAC |
| Patrón de tenant de `services/evidence.service.ts` (`findProjectForActor`) | Interno | Dueño ve lo suyo, admin todo, lo ajeno es 404 |
| `readSafeXlsxUpload` (`app/lib/excelUpload.ts`) | Interno | Lectura segura del Excel subido |
| `docs/fuentes/plantillas-iso/` | Ficheros del repo | Binarios de las plantillas, incluidos en la función (ADR-016) |
| Libro `plantillas_documentales.xlsx` | Contenido del experto | Rol, fase, obligatoriedad, tipo, vigencia y requisitos. **Fuente única**: nada de eso se deduce |

### Downstream

| Dependent | Type | What it needs from here |
|----------|------|------------------------|
| Sección «Documentación» de `/projects/[id]` | UI | Plantillas aplicables agrupadas por fase |
| Entrega 2: subida y estado «x de y» | Evidence Graph | `DocumentTemplate.id` y sus requisitos por rol |
| Audit Intelligence Platform (futuro) | Rutado | Qué requisitos justifica cada documento, igual que el vínculo por requisito |

### External dependencies

| Dependency | Purpose | Risk if unavailable |
|-----------|---------|-------------------|
| Neon PostgreSQL | Catálogo | Sin catálogo, la sección no carga |
| Vercel (bundle de función) | Servir los binarios | Si el trazado no incluye los ficheros, la descarga da 404/500: se verifica en el build y en producción |

---

## Functional Scope

### Entrega 1 — This component IS responsible for

- **Importar el libro** a `DocumentTemplate` desde una ruta solo de admin, con estas reglas:
  - Idempotente por `fichero`: reimportar actualiza, no duplica.
  - **No borra nunca.** Una plantilla que deja de estar en el libro, o que viene con «no», pasa a `vigente = false`.
  - Normaliza `si`/`sí`, `adjudicatario principal` → `adjudicatario_principal`, mayúsculas y espacios sobrantes.
  - Lee las referencias con estas reglas, confirmadas por el usuario el 13-oct:
    - separador `;` o `,`;
    - prefijo «ISO» opcional;
    - la norma se arrastra a las referencias siguientes que no la repiten.
  - **Cada referencia se vincula solo a los roles de la fila en los que existe** (decisión del usuario, 13-oct). Una referencia que no existe para **ningún** rol de su fila hace fallar la importación entera, con el número de fila y la referencia en el mensaje.
  - Rechaza también: un fichero que no existe en `plantillas-iso/`, un rol, fase o formato fuera de los valores fijados, y una fila sin los campos obligatorios.
  - Todo o nada: si hay un error, no se escribe ninguna fila.
- **Listar** las plantillas aplicables a un proyecto: vigentes y cuyo rol incluye `Project.role`, ordenadas por fase (oferta → contratación → movilización → producción → entrega → cierre) y con la marca obligatoria u opcional.
- **Servir la plantilla vigente** por una ruta autenticada colgada del proyecto. Solo se sirve si la plantilla es aplicable a ese proyecto. Proyecto ajeno o plantilla no aplicable: 404.
- **Botón «Importar catálogo documental» en `/admin`**, que sube el libro a la ruta de importación y muestra el resultado o los errores por fila.
- **Proteger el catálogo de requisitos**: `POST /api/import` con `replace=true` responde 409, no 500, si algún requisito está vinculado a una plantilla documental (decisión del usuario, 13-oct; ver domain model).
- **Sección «Documentación»** en `/projects/[id]`, en un componente aparte de `ProjectClient.tsx`, con agrupación por fase, marca de obligatoria y botón de descarga. El 13-oct se colocó después del listado de requisitos con un enlace en la barra «Flujo de trabajo»; el 15-oct, por decisión del usuario (el scroll hasta ella era excesivo), la vista del proyecto pasó a dos pestañas, **Requerimientos | Documentación**, con la activa en la URL (`?vista=documentacion`; el ancla antigua `#documentacion` sigue abriéndola).

### Entrega 2 — frontera (detalle en ADR-016 y en un spec posterior)

- Subir el documento y su PDF como `EvidenceItem` con `documentTemplateId`.
- Declarar los vínculos con los requisitos de la plantilla que existan en el proyecto.
- Estado «x de y entregados» (calculado, no persistido) y dossier ZIP por fases.

### This component is NOT responsible for

- **Decidir** rol, fase, obligatoriedad, tipo, vigencia o requisitos de una plantilla. Los escribe el experto en el libro (regla de integridad normativa).
- Rellenar o prerrellenar plantillas dentro de la app (D3).
- Avisar a los proyectos cuando cambia una plantilla (D5).
- Valorar los documentos: es del auditor, por las rutas del Evidence Graph (ADR-010). Ningún estado ni texto habla de «rechazar».
- Borrar binarios o plantillas: lo retirado se marca, no se borra; el borrado físico es de ADR-005.
- Gestionar el catálogo por tenant. Es global, como `RequirementTemplate`.

---

## Non-Functional Requirements

| Requirement | Target | Notes |
|------------|--------|-------|
| Multi-tenant isolation | Mandatory | El catálogo es global; el acceso se acota por el **proyecto**. Proyecto ajeno: 404, nunca 403 |
| RBAC | Mandatory | Importar: solo admin. Listar y descargar: dueño del proyecto o admin |
| Audit trail | Mandatory | `createdAt` y `updatedAt` en `DocumentTemplate`. La importación registra quién la hizo (`importedBy` desde la sesión) |
| Sin borrado | Mandatory | Ninguna ruta ni servicio borra una `DocumentTemplate` |
| Migraciones | Aditivas | Tabla nueva, y en la entrega 2 una columna anulable |
| Integridad normativa | Mandatory | Los tests usan `SYNTHETIC TEST DATA` marcado; nunca contenido inventado presentado como real |
| Response time (p95) | < 2 s | Listado: una consulta. Descarga: lectura de un fichero de menos de 1 MB |
| Sin `public/` | Mandatory | Las plantillas no se sirven como estáticos |

---

## Implementation Checklist

- [x] ADR-016 (catálogo cerrado; cuestiones de la entrega 2 planteadas)
- [x] Domain model (`docs/domain-models/documentacion-justificacion.md`)
- [x] API contract (`docs/api-contracts/documentacion-justificacion.md`)
- [x] Security spec (`docs/security-specs/documentacion-justificacion.md`)
- [x] Plan (`docs/plans/2026-10-13-documentacion-justificacion-entrega-1.md`)
- [x] Migración aditiva aplicada **solo en Test** (`migrate status` contra `ep-jolly-resonance` antes)
- [x] Parser e importador con TDD
- [x] Rutas de listado, descarga e importación
- [x] Sección «Documentación»
- [x] `tsc`, `lint`, `build` y suite completa en verde (en serie)
- [x] El build incluye los binarios en la traza de la ruta de descarga
- [x] Prueba en el navegador contra Test (login del usuario)
- [x] Test plan (`docs/test-plans/documentacion-justificacion.md`)
- [ ] Producción migrada por el usuario **antes** de fusionar en `main`

---

## Open Questions

Ninguna para la entrega 1. Cerradas el 13-oct:

1. ~~Referencia `5.6.5` de «Acta Aprobación Información»~~: corregida por el usuario a `5.7.2; 5.7.4`.
2. ~~Carga del catálogo en producción~~: por **subida del Excel desde la app**, consecuencia de la 3. Se registra en ADR-016.
3. ~~Pantalla de importación~~: **botón «Importar catálogo documental» en `/admin`** (decisión del usuario). Entra en la entrega 1.
