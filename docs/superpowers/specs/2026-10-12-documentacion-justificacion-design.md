# Documentación de justificación por proyecto — Diseño

**Fecha:** 2026-10-12 · **Estado:** propuesto, pendiente de revisión del usuario
**Origen:** sesión de brainstorming del 12-oct. Todas las decisiones de producto de este documento son del usuario; las marcadas **(rec.)** se aceptaron sobre una recomendación.

---

## 1. Qué se construye

Cada proyecto gestiona los documentos que justifican su ejecución, a partir de un catálogo de **plantillas documentales de elaboración propia** de Eficax (`docs/fuentes/plantillas-iso/`, 28 ficheros: 12 Word y 16 Excel).

El ciclo para el dueño del proyecto:

1. Ve qué documentos le corresponden según el rol del proyecto, ordenados por fase, con su estado.
2. Descarga la plantilla vigente en blanco.
3. La rellena **fuera de la aplicación**.
4. Sube el documento resultante, y además su **versión final en PDF**.
5. El auditor lo valora.
6. Al final exporta un **dossier de justificación**: un ZIP por fases con un índice en PDF.

## 2. Decisiones tomadas

| # | Decisión | Detalle |
|---|---|---|
| D1 | Alcance | La justificación es **de cumplimiento ISO 19650 y también administrativa o contractual**. |
| D2 | Modelo | **Cada documento es un `EvidenceItem`.** Se reutiliza el Evidence Graph: subida privada a Blob, versionado, `AnalysisDocument` y valoración del auditor. No se crea un gestor documental paralelo. |
| D3 | Uso de la plantilla | Se descarga, se rellena fuera y se sube el resultado. Ni se prerrellena ni hay formularios en la app. |
| D4 | Propiedad | Las plantillas son de elaboración propia y se pueden entregar a los tenants. No llevan texto de la norma ISO, así que no tienen el problema de licencia de `CLAUDE.md`. |
| D5 | Versiones de plantilla | La descarga sirve siempre la versión **vigente**. Lo ya subido no cambia, porque es la evidencia de lo que se entregó. No se avisa a los proyectos. |
| D6 | Actores | El **dueño sube y declara; el auditor valora** (ADR-010). |
| D7 | Multiplicidad | Puede haber **varios documentos de una misma plantilla**, por ejemplo un acta por reunión. Cada uno es una evidencia y conserva su historial de versiones. |
| D8 | Estado documental | Se muestra por proyecto («12 de 20 entregados») con su estado por plantilla. |
| D9 | Ubicación | Una sección nueva **«Documentación»** dentro del proyecto. |
| D10 | Dossier | **ZIP ordenado por fase con un índice en PDF.** |
| D11 | Formato para IA | Se exige la **versión final en PDF** además del Word o Excel, porque la IA solo procesa PDF (ADR-008 D5). |
| D12 | Plantillas en blanco | Se guardan **en el repositorio** (unos 5 MB), no en Blob. |
| D13 | Catálogo | **Tabla en base de datos, cargada desde un Excel de trabajo** que rellena el experto (enfoque A). |
| D14 | Prioridad | Se desarrolla **ahora**, en paralelo a la redacción de los 91 criterios. |

## 3. Arquitectura

### 3.1 Catálogo: `DocumentTemplate` (tabla nueva, global)

Es un catálogo global, no por tenant, como `RequirementTemplate`. Se alimenta de `docs/fuentes/trabajo/plantillas_documentales.xlsx`.

| Campo | Origen en el Excel | Notas |
|---|---|---|
| fichero | columna «Fichero» | Clave natural, la ruta dentro de `plantillas-iso/` |
| nombre | «Nombre» | Lo edita el experto |
| formato | «Formato» | `docx` / `xlsx` |
| vigente | «Vigente» | Resuelve los duplicados. Lo no vigente **nunca se borra**: deja de ofrecerse |
| roles | «Rol» | Uno o varios de los tres roles de `Project.role` |
| fase | «Fase» | oferta / contratación / movilización / producción / entrega / cierre (fijadas por el usuario el 12-oct: «inicio» pasó a «oferta» y se añadió «contratación») |
| obligatoria | «Obligatoria» | sí / no |
| tipo | «Tipo» | iso / administrativa / ambas |
| requisitos | «Requisitos que justifica» | Lista de `norma / item`, que se resuelve contra `RequirementTemplate` **junto con el rol** |

La reimportación es idempotente por `fichero` y **no borra nunca**: una plantilla retirada pasa a `vigente = false`. Una evidencia histórica puede seguir apuntando a ella.

`norma + item` no es único en `RequirementTemplate`: su clave única incluye título, descripción y rol. El vínculo plantilla-requisito tiene que resolverse siempre junto con el rol. El importador **rechaza** una referencia que no resuelva, en lugar de ignorarla.

### 3.2 Evidencia: una columna nueva

`EvidenceItem.documentTemplateId String?` con FK a `DocumentTemplate` y `onDelete: Restrict`. Es un cambio aditivo y anulable, así que las evidencias que ya existen no se tocan.

Una evidencia sin plantilla sigue siendo válida: es la evidencia suelta del panel por requisito. Un documento sin requisitos (D1, el caso administrativo) es una evidencia con plantilla y sin vínculos; ADR-015 D2 ya lo admite.

### 3.3 Subida

Se reutiliza el handshake de client upload: el prefijo `evidence/{projectId}/`, el acceso `private` y `sourceRef` igual al pathname, con los cuatro errores corregidos el 12-oct.

Un gesto de la sección «Documentación» hace lo siguiente:
1. Sube el binario.
2. Da de alta la evidencia con su `documentTemplateId`.
3. Sube el PDF final (D11).
4. Declara los vínculos con los requisitos de la plantilla **que existan en el proyecto**.

**Decisión abierta para el ADR:** cómo se modela «Word/Excel + PDF». Hay dos opciones:
- a) Dos `EvidenceItem` hermanos.
- b) Una evidencia con dos binarios.

El modelo actual tiene **un** `sourceRef` y **un** `AnalysisDocument` por evidencia, así que la (b) exige cambiar el esquema. Hay que decidirlo en el ADR y no improvisarlo en el código.

**Decisión abierta para el ADR:** quién declara los vínculos. ADR-010 fija que el acto lo define la ruta, y la ruta del dueño declara pero no valida. Si la ruta de documentación declara en bloque, el ADR nuevo tiene que acotar ese punto.

### 3.4 Estado documental

Se calcula y no se persiste. Para un proyecto, las plantillas aplicables son las vigentes cuyo rol incluye `Project.role`. Para cada una, el estado se obtiene de sus evidencias.

Propuesta, que hay que **confirmar en el component-spec**:

| Estado | Condición |
|---|---|
| pendiente | ninguna evidencia no archivada |
| entregado | al menos una evidencia `submitted` o posterior |
| valorado | al menos una evidencia con valoración del auditor |

Corrección del usuario del 3-sep: el auditor **valora, no rechaza**. El estado no se puede formular en términos de rechazo.

### 3.5 Descarga de plantillas

Se sirven por una ruta **autenticada**, no desde `public/`. Los ficheros viven en el repositorio, así que hay que incluirlos en el paquete de la función.

⚠️ **Verificar antes de implementar:** el mecanismo de Next 16 para incluir ficheros en la función (`outputFileTracingIncludes` u otro). Hay que leerlo en `node_modules/next/dist/docs/`, como pide `AGENTS.md`, y no darlo por supuesto.

### 3.6 Dossier

Es un ZIP por fases con un índice PDF (jsPDF ya está en las dependencias). Hoy no hay librería de ZIP.

⚠️ **Riesgo que hay que resolver antes de diseñar el endpoint:** el límite de cuerpo de respuesta de las funciones de Vercel, de unos 4,5 MB, que hay que verificar en la documentación vigente. Un dossier con planos lo supera de largo. Hay tres salidas:
- a) Respuesta por streaming, si el plan Hobby lo admite.
- b) Generar el ZIP en Blob y entregar una URL firmada. El ZIP ocuparía cupo de Blob y heredaría el problema de borrado de ADR-005.
- c) Montar el ZIP en el navegador a partir de URLs firmadas.

Se elige en el ADR con datos verificados, no por preferencia.

## 4. Contenido que aporta el usuario (ARCHITECTURAL INPUT REQUIRED)

El libro `docs/fuentes/trabajo/plantillas_documentales.xlsx` lo genera `scripts/preparar-excel-plantillas-documentales.mjs`. **Ni el rol, ni la fase, ni la obligatoriedad, ni los requisitos de cada plantilla se deducen**: los escribe el experto. Hasta que estén escritos, el desarrollo avanza con **SYNTHETIC TEST DATA** marcados como tales.

**Estado del libro al cerrar el 12-oct:**
- **27 filas.** `Plantilla-Manual BIM-V01.docx` **queda fuera del catálogo por decisión del usuario**: no forma parte de la documentación de gestión de un proyecto. El fichero sigue en `plantillas-iso/`, pero sin fila no se cataloga.
- Rol, Fase, Obligatoria y Tipo están completos (27/27). Tipo es «ambas» en todas.
- **Vigente y «Requisitos que justifica» están vacíos (0/27).**
- Hay variaciones de escritura que el importador **normaliza** sin pedir corrección: `si`/`sí`, `adjudicatario principal`/`adjudicatario_principal`, espacios sobrantes.

Duplicados que hay que resolver en la columna «Vigente»:
- Manual de control de calidad (sin sufijo / V01).
- LOIN (V01 / V02).
- Matriz de interferencias (dos ficheros).
- PreBEP (Word / Excel: hay que confirmar si son el mismo documento).

## 5. Fuera de alcance

- Rellenar plantillas dentro de la app o prerrellenarlas (D3).
- Avisar a los proyectos cuando cambia una plantilla (D5).
- Convertir Word o Excel a PDF (D11 lo evita exigiendo el PDF).
- Analizar los documentos con IA: llega con el componente de IA.
- Borrar binarios huérfanos: pertenece a ADR-005.

## 6. Pruebas

- Servicio y API con Vitest contra la rama Test, `fileParallelism: false`.
- El importador del catálogo con TDD:
  - Fila válida.
  - Referencia de requisito que no resuelve: se rechaza.
  - Reimportación idempotente.
  - Retirada de una plantilla: pasa a `vigente = false` y no se borra.
- Tenant cruzado: 404, nunca 403.
- Prueba manual en el navegador del gesto completo: descargar, subir, ver el estado y generar el dossier.

## 7. Entregas

- **Entrega 1, el catálogo visible:**
  - Tabla `DocumentTemplate` e importador del libro.
  - Ruta autenticada de descarga.
  - Sección «Documentación» del proyecto con las plantillas aplicables a su rol, agrupadas por fase, con la marca de obligatoria y el botón de descarga.

  No depende de ninguna cuestión abierta del ADR ni de la columna de requisitos.
- **Entrega 2, la justificación:**
  - Subida del documento y de su PDF, con `documentTemplateId` en la evidencia.
  - Declaración de vínculos.
  - Estado «x de y» y dossier.

  Necesita las cuatro cuestiones abiertas del ADR-016 y la columna de requisitos.

## 8. Pipeline obligatorio (CLAUDE.md del proyecto)

`component-spec → ADR-016 → domain-model → api-contract → security-spec → plan → [impl] → migration → test-plan`
