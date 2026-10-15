# Test Plan: Documentación de justificación por proyecto (entrega 1)

> BAOS Component: Evidence Graph (catálogo documental que alimenta la entrega 2)
> Component Spec: docs/component-specs/documentacion-justificacion.md
> API Contract: docs/api-contracts/documentacion-justificacion.md
> Domain Model: docs/domain-models/documentacion-justificacion.md
> Security Spec: docs/security-specs/documentacion-justificacion.md
> ADR: docs/adr/ADR-016-catalogo-de-plantillas-documentales.md
> Date: 2026-10-14
> Status: Implementado — 46 tests en 5 ficheros, en verde contra Test (`ep-jolly-resonance`)

---

## Resultado medido (2026-10-14)

| Comprobación | Resultado |
|---|---|
| `npm test` (suite completa, en serie) | 12 ficheros, 173 tests, en verde |
| Tests de este componente | 5 ficheros, 46 tests, en verde |
| `tsc --noEmit` y `npm run lint` | Sin errores |
| `npm run build` | Correcto; las tres rutas nuevas compilan |
| Trazado de binarios (`.nft.json`) | 26 de 26 ficheros de `plantillas-iso/` en la ruta de descarga y en la de importación |
| Prueba en navegador contra Test | Correcta (detalle abajo) |
| Verificación en el preview de Vercel | **Pendiente** (paso posterior al plan) |

Los 26 ficheros eran 28 hasta el 14-oct, cuando se retiraron `PLANTILLA-LOIN-V02.xlsx` y `Plantilla-MatrizInterferenciasModelosBIM.xlsx` (duplicado de la matriz del catálogo). Ninguno de los dos estaba en el catálogo.

---

## Test Scope

### In scope

- Parser del libro `plantillas_documentales.xlsx` (`app/lib/documentTemplateImport.ts`).
- Servicio del catálogo (`services/document-template.service.ts`): importación todo o nada y versionada, listado aplicable y resolución segura del fichero.
- Cabecera `Content-Disposition` (`app/lib/contentDisposition.ts`).
- Rutas `GET /api/projects/[id]/document-templates`, `GET /api/projects/[id]/document-templates/[templateId]/file` y `POST /api/admin/document-templates/import`.
- El 409 de `POST /api/import` con `replace=true` cuando hay requisitos vinculados.
- Trazado de los binarios en el bundle (ADR-016 D1).
- Sección «Documentación» del proyecto y bloque «Catálogo documental» de `/admin`, solo en navegador.

### Out of scope

- Corrección de la migración: la cubre el propio `migrate deploy` en Test y la revisión del SQL (Task 1 del plan).
- Contenido de las plantillas: es de Eficax y no se valida en código.
- Rol, fase, obligatoriedad y requisitos de cada plantilla: los decide el experto en el libro (regla de integridad normativa). Los tests solo comprueban que se leen y aplican tal como vienen.
- Entrega 2 (subida, vínculos declarados, estado «x de y», dossier).

---

## Test Levels

| Level | Applicable | Rationale |
|-------|-----------|-----------|
| Unit | Sí | Parser y cabecera: lógica pura sin E/S |
| Integration | Sí | Servicio y route handlers contra la base de Test real, con un directorio temporal de plantillas `SYNTHETIC` |
| Smoke | Sí | Tres comprobaciones 401 sin sesión en `scripts/smoke-routes.mjs` |
| Audit-specific | Sí | Aislamiento por proyecto, sin borrado, historial versionado, protección del catálogo de requisitos |

No hay tests de componentes React: el repo ejecuta Vitest con `environment: "node"`. La UI se verifica en navegador.

---

## Critical Test Cases

Ficheros: `P` = `tests/lib/documentTemplateImport.test.ts`, `C` = `tests/lib/contentDisposition.test.ts`, `S` = `tests/services/document-template.service.test.ts`, `L` = `tests/api/document-templates.test.ts`, `I` = `tests/api/document-templates-import.test.ts`.

### Authentication & Authorization

| ID | Test Case | Test | Expected Result |
|----|-----------|------|----------------|
| AUTH-01 | Listado sin sesión | L «401 sin sesion» | 401 |
| AUTH-02 | Descarga sin sesión | L «401 sin sesion» | 401 |
| AUTH-03 | Importación sin sesión | I «401 sin sesion» | 401 |
| AUTH-04 | Importación por un usuario no admin | I «403 a un usuario no admin» | 403 |
| AUTH-05 | Importación por un admin bloqueado | I «403 con el mensaje de cuenta bloqueada» | 403 con `BLOCKED_ACCOUNT_MESSAGE` |
| AUTH-06 | Un admin lista un proyecto ajeno | L «404 a otro usuario; 200 a un admin»; S «proyecto ajeno es notFound; un admin lo ve» | 200 |

### Tenant Isolation (BAOS Mandatory)

El catálogo es global; el aislamiento se acota por el proyecto.

| ID | Test Case | Test | Expected Result |
|----|-----------|------|----------------|
| TENANT-01 | Listado de un proyecto de otro usuario | L «404 a otro usuario; 200 a un admin» | 404 «Proyecto no encontrado.» |
| TENANT-02 | Descarga desde un proyecto ajeno, desde un proyecto inexistente, de una plantilla de otro rol, retirada o inexistente | L «404 identico para ajeno, otro rol, retirada e inexistente» | 404 con el mismo cuerpo «Plantilla no encontrada.» en los cinco casos |
| TENANT-03 | Se comprueba el proyecto antes que la plantilla | S «plantilla inexistente y proyecto ajeno son notFound» | Una plantilla válida no confirma un proyecto ajeno |
| TENANT-04 | El actor de la importación sale de la sesión | S «crea la plantilla en version 1…» (`createdBy`, `importedBy` = admin de la sesión) | La ruta no acepta actores en el cuerpo |

### Happy Path

| ID | Test Case | Test | Expected Result |
|----|-----------|------|----------------|
| HP-01 | Listado al dueño | L «200 al dueno, con las aplicables y sin el fichero» | 200, solo plantillas aplicables, sin el campo `fichero` |
| HP-02 | Orden por fase y nombre | S «lista solo vigentes del rol, por fase y nombre, sin el fichero» | Oferta → … → Cierre; dentro de la fase, por nombre |
| HP-03 | Descarga docx | L «200 con el binario y las cabeceras del contrato» | 200, binario íntegro, `Content-Type` de Word, `Content-Length`, `Cache-Control: private, no-store`, `nosniff` |
| HP-04 | Descarga xlsx | L «xlsx lleva su Content-Type» | `Content-Type` de Excel |
| HP-05 | Importación de una fila válida | S «crea la plantilla en version 1…» | Plantilla en versión 1 con sus vínculos |
| HP-06 | Importación del libro real desde `/admin` | Navegador (abajo) | 23 nuevas, 47 vínculos |

### Validation

| ID | Test Case | Test | Expected Result |
|----|-----------|------|----------------|
| VAL-01 | Sin fichero o fichero que no es xlsx | I «400 sin fichero y con un fichero que no es xlsx» | 400 |
| VAL-02 | Libro con errores | I «400 con los errores por fila y sin escribir nada» | 400 «El libro tiene errores.» con `details` por fila |
| VAL-03 | Falta la hoja «Plantillas» | P «exige la hoja Plantillas» | Error, sin filas |
| VAL-04 | Falta una columna | P «exige todas las columnas» | Error que nombra la columna |
| VAL-05 | Rol, fase o tipo fuera de los valores fijados; errores de varias filas | P «acumula los errores de todas las filas y no devuelve filas» | Todos los errores, ninguna fila |
| VAL-06 | Formato que no coincide con la extensión | P «rechaza un formato que no coincide con la extension» | Error de la fila |
| VAL-07 | Fichero repetido | P «rechaza un fichero repetido» | Error con la fila anterior |
| VAL-08 | Referencia sin norma | P «falla si la primera referencia no lleva norma» | Error con ejemplo |
| VAL-09 | Normalización de `sí`/`NO`, roles con espacio, fase con tilde, requisitos vacíos, filas vacías | P «normaliza una fila valida», «acepta requisitos vacios y vigente no», «ignora las filas vacias» | Fila normalizada |
| VAL-10 | Referencias con prefijo ISO, separadores mezclados y norma arrastrada | P «arrastra la norma y admite prefijo ISO…», «devuelve lista vacia para texto vacio» | Referencias resueltas |

### Business Invariants (BAOS Critical)

| ID | Test Case | Test | Expected Result | Invariant source |
|----|-----------|------|----------------|-----------------|
| INV-01 | No se borra nunca una plantilla; retirar es `vigente = false` | S «retira sin borrar la plantilla que sale del libro, una sola vez» + revisión de código | La plantilla sigue en la base. Solo `tests/helpers/document-templates.ts` y `scripts/clean-test-tenants.mjs` llaman a `documentTemplate.deleteMany`, y solo sobre `SYNTHETIC-` | Domain model, invariante 1 |
| INV-02 | Todo o nada | S «falla entera si una referencia no existe…», «falla si el fichero no esta…»; I «400 con los errores por fila y sin escribir nada» | Ninguna fila escrita | Invariante 2 |
| INV-03 | Idempotencia | S «es idempotente: reimportar lo mismo no crea version»; navegador (23 sin cambios) | Ni versión nueva ni cambio de `version` | Invariante 3 |
| INV-04 | `version` = último snapshot | S «un cambio crea la version 2…», «retira sin borrar…» | `version` 2 con snapshot 2 | Invariante 4 |
| INV-05 | Cada vínculo es de un rol de la fila | S «crea la plantilla en version 1 y vincula cada requisito solo a los roles de la fila» | 1.1 solo para adjudicador; 2.1 solo para principal | Invariante 5 |
| INV-06 | Cada referencia resuelve para algún rol | S «falla entera si una referencia no existe para ningun rol de la fila» | Error con fila y referencia | Invariante 6 |
| INV-07 | El fichero existe al importar | S «falla si el fichero no esta en el directorio de plantillas» | Error de la fila | Invariante 7 |
| INV-08 | Aplicable = vigente y rol del proyecto | S «lista solo vigentes del rol…», «%s es notFound» (otroRol, retirada) | Ni se lista ni se descarga | Invariante 8 |
| INV-09 | Borrar un requisito vinculado lo impide la FK | S «borrar un requisito vinculado lo impide la FK (Restrict)» | P2003 real de la base | Domain model, impacto 1 |
| INV-10 | `/api/import` con `replace=true` y vínculos → 409 | I «409 si hay plantillas documentales vinculadas, sin crear nada» | 409 con mensaje; no se llama a `createMany` | Domain model, impacto 1 |
| INV-11 | Otro error de `/api/import` sigue siendo 500 | I «otro error sigue siendo 500» | 500 | Contrato |

El 409 se prueba con el P2003 simulado para no borrar el catálogo real de Test; que la base lo lance de verdad lo prueba INV-09.

### Seguridad de la descarga

| ID | Test Case | Test | Expected Result | Amenaza (security-spec) |
|----|-----------|------|----------------|-----------------|
| SEC-01 | Fichero con ruta en el libro (`../`, `/`, `\`) | P «rechaza un fichero con ruta: %s» (3 casos) | Error de la fila | Recorrido de rutas, primer cierre |
| SEC-02 | Fichero guardado que resuelve fuera del directorio | S «%s es notFound» (maliciosa) | `notFound`; se registra el intento | Recorrido de rutas, segundo cierre |
| SEC-03 | Nombre con tildes, comillas, barras y saltos de línea | C «da un filename ASCII…», «neutraliza comillas, barras y saltos de linea» | `filename` ASCII sin `"`, `\` ni controles; nombre real en `filename*` | Inyección en cabeceras |
| SEC-04 | Binario en catálogo pero no desplegado | L «500 si el binario no esta desplegado»; S «binario ausente es missing» | 500 genérico y log «plantilla en catalogo sin binario desplegado» | Bundle de Vercel |

### Versioning / Audit Trail

| ID | Test Case | Test | Expected Result |
|----|-----------|------|----------------|
| VER-01 | Alta crea la versión 1 con snapshot | S «crea la plantilla en version 1…» | Una fila en `DocumentTemplateVersion` |
| VER-02 | Un cambio crea versión con el estado resultante | S «un cambio crea la version 2…» | Snapshot 2 = estado nuevo (ADR-006), `updatedBy` = admin |
| VER-03 | Retirar crea versión con `vigente: false`, una sola vez | S «retira sin borrar…» | Segunda importación: 0 retiradas |

---

## Prueba en navegador contra Test (2026-10-14)

Servidor local con `npm run dev` contra `ep-jolly-resonance`. Inició sesión el usuario (`figual@eficax.com`).

| Paso | Esperado | Resultado |
|---|---|---|
| Importar `plantillas_documentales.xlsx` en `/admin` | 23 nuevas, 47 vínculos | ✅ En base: 23 vigentes, 23 filas de versión, 47 vínculos, creador el usuario |
| Reimportar el mismo libro | 23 sin cambios | ✅ «23 sin cambios … 47 vínculos»; ninguna plantilla en versión 2 |
| Reparto por rol | 14 / 22 / 15 | ✅ adjudicador 14, adjudicatario principal 22, adjudicatario 15 |
| Pestaña «Documentación» de la vista del proyecto (15-oct; sustituye al enlace de «Flujo de trabajo») | Abre la sección sin scroll, `?vista=documentacion` en la URL, «Atrás» vuelve, flechas del teclado cambian de pestaña, `#documentacion` la abre | ✅ |
| Sección agrupada por fase con marca de obligatoria | Visible por fase | ✅ Pestañas con color por fase; 6 pestañas, se abre la primera fase con plantillas |
| Descarga de las plantillas Excel armonizadas | 200 y fichero íntegro | ✅ Las 10 xlsx del rol principal: 200 y mismo tamaño que la versión armonizada. SHA-256 idéntico en `Plantilla-PlanMovilización.xlsx` y `Plantilla-MIDP.xlsx` |
| Nombre con tildes en la descarga | Llega bien | ✅ `filename*` decodifica a `Plantilla-PlanMovilización.xlsx` |

Los proyectos de adjudicatario principal y adjudicatario se crearon en Test para la prueba, marcados `SYNTHETIC TEST DATA`, y se les generaron sus requisitos con `generateRequirementsForProject`.

---

## Coverage Requirements

| Path type | Required coverage | Estado |
|-----------|-----------------|---|
| Auth y aislamiento por proyecto | 100% | Cubierto (AUTH, TENANT) |
| Invariantes del domain model | 100% | Cubierto (INV-01 a INV-11) |
| Happy path de las tres rutas | 100% | Listado y descarga automáticos; importación correcta solo en navegador (ver gaps) |
| Errores de validación | Todos los documentados | Cubierto, salvo los límites de tamaño (ver gaps) |
| Forma de las respuestas de error | Spot check | Cubierto en los 404, 400 y 409 |

---

## Test Data Strategy

### Tenant setup

`createTenant` (`tests/helpers/db.ts`) crea empresa, admin y usuario. Cada fichero crea sus tenants en `beforeAll` y los borra en `afterAll`: `doc-templates-svc`, `doc-templates-svc-ajeno`, `doc-templates-api-a`, `doc-templates-api-b`, `doc-templates-import`.

### Fixtures (`tests/helpers/document-templates.ts`)

| Fixture | Purpose |
|---------|---------|
| `createSyntheticTemplatesDir(ficheros)` | Directorio temporal con binarios `SYNTHETIC TEST DATA`; las rutas lo leen por un mock de `getPlantillasDir` |
| `createSyntheticRequirementTemplate(item, role)` | Requisito de norma `SYNTHETIC-19650-9` |
| `createSyntheticDocumentTemplate(createdBy, overrides)` | Plantilla `SYNTHETIC-` |
| `cleanupSyntheticDocumentTemplates()` / `cleanupSyntheticRequirementTemplates()` | Limpieza; deben correr antes de `cleanupTenant` (FK `Restrict` hacia `User`) |

La importación de los tests pasa `ficheroPrefix: "SYNTHETIC-"` para no retirar el catálogo real de Test.

Tras un run fallido: `node scripts/clean-test-tenants.mjs --apply`, que también borra las plantillas `SYNTHETIC-` y los requisitos `SYNTHETIC-19650-9`.

### Seed data

Ninguna. El catálogo real se carga desde `/admin` con el libro.

---

## Smoke Tests

En `scripts/smoke-routes.mjs` (no `scripts/smoke.ts`):

| Smoke check | Endpoint | Expected |
|-------------|----------|---------|
| document templates list without session | `GET /api/projects/test-project-id/document-templates` | 401 |
| document template download without session | `GET /api/projects/test-project-id/document-templates/test-template-id/file` | 401 |
| document templates import without session | `POST /api/admin/document-templates/import` | 401 |

**Pendiente:** ejecutarlos contra producción tras el despliegue.

---

## BAOS Compliance Test Obligations

- [x] Aislamiento verificado (TENANT-01 a TENANT-04)
- [x] El listado no filtra plantillas de otro rol ni retiradas
- [x] Invariantes aplicadas en la API, no solo en el servicio (I y L)
- [x] Versiones en cada cambio del catálogo (VER-01 a VER-03)
- [x] El borrado de un requisito vinculado se bloquea (INV-09, INV-10)
- [x] Sin estados de aprobación en esta entrega; ningún texto habla de «rechazar»

---

## Gaps conocidos

| Gap | Riesgo | Cobertura actual |
|---|---|---|
| El 200 de `POST /api/admin/document-templates/import` no tiene test automático | Bajo | La ruta lee el directorio real; se probó en navegador con el libro real (HP-06) y el servicio está cubierto |
| Límites del parser (2000 filas, 50 columnas, 10.000 caracteres) y del upload (firma ZIP, 5 MB) sin test propio | Bajo | Constantes compartidas con `requirementImport.ts` y `readSafeXlsxUpload`, ya en uso |
| UI sin tests automáticos | Medio | Prueba en navegador; la vista móvil no se ha comprobado |
| Descarga en el preview de Vercel | Medio | Trazado verificado en el build local (26/26); falta el preview |

---

## Open Questions

Ninguna para la entrega 1.
