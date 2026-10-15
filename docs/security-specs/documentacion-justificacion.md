# Security Spec: Documentación de justificación por proyecto (entrega 1)

> BAOS Component: Evidence Graph (catálogo de plantillas documentales)
> Component Spec: docs/component-specs/documentacion-justificacion.md
> API Contract: docs/api-contracts/documentacion-justificacion.md · ADR: ADR-016
> Date: 2026-10-13
> Status: Draft

---

## Authentication Requirements

| Endpoint | Auth required | Session source |
|----------|--------------|---------------|
| `GET /api/projects/[id]/document-templates` | Sí | `getAuthSession(req)` (`app/lib/auth.ts`). Cuenta bloqueada → `null` → 401 |
| `GET /api/projects/[id]/document-templates/[templateId]/file` | Sí | Igual |
| `POST /api/admin/document-templates/import` | Sí | `getAuthSession(req, { allowBlocked: true })` para responder 403 con `BLOCKED_ACCOUNT_MESSAGE`, como `/api/import-templates` |
| `POST /api/import` (cambio) | Sí | Sin cambios |

Sin sesión: 401 inmediato, antes de tocar la base o el disco.

La descarga **no** se hace con URL firmada ni enlace público: cada petición pasa por la sesión. Las plantillas **no** están en `public/` (ADR-016).

---

## RBAC Matrix

| Action | `user` | `admin` | Notes |
|--------|--------|---------|-------|
| Listar plantillas de un proyecto propio | ✅ | ✅ | Solo las aplicables al rol del proyecto |
| Listar plantillas de un proyecto ajeno | ❌ (404) | ✅ | Admin ve todos los proyectos, como en el resto de la app |
| Descargar una plantilla aplicable a un proyecto propio | ✅ | ✅ | |
| Descargar una plantilla no aplicable o no vigente | ❌ (404) | ❌ (404) | La aplicabilidad no depende del rol del usuario |
| Importar el catálogo | ❌ (403) | ✅ | Ruta bajo `/api/admin/` (ADR-004: admin sin excepciones) |
| Borrar una plantilla | ❌ | ❌ | No existe ruta ni función de servicio |

RBAC en el handler y en el servicio, nunca solo en la UI. El botón de `/admin` es comodidad, no control.

---

## Tenant Isolation Requirements

El catálogo es global y no contiene datos de cliente. **Lo que hay que aislar es el proyecto**: su existencia, su rol y su nombre.

| Requirement | Implementation |
|-------------|---------------|
| Proyecto acotado al actor | `project.findFirst({ id, ...(isAdmin ? {} : { userId }) })`, el mismo criterio que `findProjectForActor` |
| Proyecto ajeno → 404 | Mismo mensaje que proyecto inexistente («Proyecto no encontrado.»). Nunca 403 |
| Plantilla no aplicable → 404 | Mismo cuerpo para inexistente, no vigente y de otro rol: no se revela que existe |
| Orden de comprobación | Primero el proyecto y después la plantilla. Así una plantilla válida no confirma que existe un proyecto ajeno |

---

## Amenazas específicas y controles

| Amenaza | Control |
|---|---|
| **Recorrido de rutas** en la descarga (`../`) | El nombre sale solo de `DocumentTemplate.fichero`. El importador rechaza un `fichero` con `/`, `\`, `..` o caracteres de control. La descarga comprueba que `path.resolve(DIR, fichero)` empieza por `DIR + sep`. Doble cierre |
| **Inyección en cabeceras** por el nombre del fichero (`Content-Disposition`) | `filename` en ASCII con `"`, `\` y los caracteres de control sustituidos; nombre real en `filename*=UTF-8''` con `encodeURIComponent` |
| Interpretación del binario por el navegador | `X-Content-Type-Options: nosniff`, `Content-Type` fijado por `formato` (nunca deducido) y `attachment` |
| Caché compartida de una respuesta autenticada | `Cache-Control: private, no-store` |
| **Excel malicioso o enorme** en la importación | `readSafeXlsxUpload`: extensión `.xlsx`, firma ZIP y 5 MB máximo. El parser limita filas, columnas y longitud de celda (constantes de `requirementImport.ts`: 2000, 50 y 10.000) |
| Importación parcial que deje el catálogo incoherente | Una transacción. Con cualquier error, no se escribe nada |
| **Pérdida del contenido del experto** por un borrado del catálogo de requisitos | `DocumentTemplateRequirement.requirementTemplate` con `onDelete: Restrict`; `/api/import` traduce el P2003 a 409 |
| Suplantación del actor en la importación | `createdBy`, `updatedBy` e `importedBy` salen de la sesión; el cuerpo no acepta actores |
| Enumeración de plantillas por id | Ids `cuid`, y la descarga exige un proyecto propio al que la plantilla aplique |

---

## Sensitive Data Inventory

| Field | Entity | Sensitivity | Protection |
|-------|--------|-------------|-----------|
| Binarios de plantilla | repo / bundle | Propiedad de Eficax, entregable a tenants (D4 del diseño). No llevan texto ISO | Solo por ruta autenticada; nunca en `public/` |
| `fichero` | `DocumentTemplate` | Interno: revela la estructura del repo | No sale en las respuestas de usuario; solo en el nombre de descarga |
| `Project.name`, `Project.role` | `Project` | Dato de tenant | Solo `role` sale en el listado, y solo al dueño o al admin |

**Logging**: los errores registran ruta, `projectId` y `templateId`, nunca rutas absolutas del disco en la respuesta. El error de binario ausente se registra en el servidor con el nombre del fichero; al cliente le llega un 500 genérico.

---

## Audit Trail Requirements

| Event | What to record | Where |
|-------|---------------|-------|
| Plantilla creada | `createdAt`, `createdBy`, versión 1 | `DocumentTemplate` + `DocumentTemplateVersion` |
| Plantilla cambiada o retirada | estado resultante, `importedBy`, fecha | `DocumentTemplateVersion` (ADR-006); `updatedBy` en la plantilla |
| Importación sin cambios | nada | Idempotencia: no hay ruido en el historial |
| Descarga | no se registra en la entrega 1 | Es lectura de material no sensible. Si la certificación lo exigiera, se añade con ADR |
| Plantilla borrada | imposible | Sin ruta ni servicio |

---

## External Service Dependencies

| Service | Purpose | Credential | Failure mode |
|---------|---------|-----------|-------------|
| Neon PostgreSQL | Catálogo | `DATABASE_URL` (existente) | Listado e importación caen; la app sigue |
| Bundle de Vercel | Binarios | — | Si el trazado no incluye los ficheros, la descarga da 500. Se detecta en la verificación del preview |

Ninguna variable de entorno nueva. No usa Blob en la entrega 1.

---

## Deployment Requirements

| Requirement | Details |
|------------|---------|
| Migración | Aditiva (3 tablas). En **Test** antes de implementar; en **producción** la aplica el usuario con `scripts/migrar-produccion.ps1` **antes** de fusionar en `main` (un push a `main` despliega sin migrar) |
| `next.config.js` | Entradas de `outputFileTracingIncludes` de ADR-016 D1 |
| Verificación de trazado | Tras `npm run build`, comprobar que los `.nft.json` de la ruta de descarga y de la de importación listan `docs/fuentes/plantillas-iso/*` |
| Verificación en preview | Antes de fusionar: descargar una plantilla en el despliegue de preview de la rama |
| Runtime | Node.js (`export const runtime = "nodejs"`): hace falta `fs` |
| Duración | Lectura de menos de 1,2 MB y una importación de 23 filas: muy por debajo de los 300 s de Hobby |
| Carga inicial del catálogo en producción | El usuario sube el libro desde `/admin` tras el despliegue |

---

## Operational Notes

### Verificar en producción

1. `/admin` → «Importar catálogo documental» → el recuento coincide con las filas del libro.
2. Un proyecto de cada rol muestra el número de plantillas esperado (hoy: adjudicador 14, adjudicatario principal 22, adjudicatario 15).
3. La descarga de una plantilla `docx` y otra `xlsx` abre bien.
4. Smoke sin sesión: las tres rutas nuevas dan 401 (`scripts/smoke-routes.mjs`).

### Diagnóstico

- Descarga en 500 con «plantilla en catalogo sin binario desplegado» en los logs de Vercel: falla la clave de `outputFileTracingIncludes` o el fichero no está en el commit desplegado.
- Importación 400 con `details`: error del libro, por fila. No es un fallo del sistema.
- `/api/import` en 409: comportamiento esperado; el catálogo de requisitos está protegido.

### Rollback

1. Revertir el commit; Vercel redespliega.
2. Las tablas nuevas pueden quedarse: nada fuera del módulo las lee. **No** se borran a mano: contienen el historial del catálogo.

---

## BAOS Security Compliance Checklist

- [ ] RBAC en la capa API (handler + servicio)
- [ ] Proyecto acotado por `userId` o admin en listado y descarga
- [ ] 404 idéntico para proyecto ajeno e inexistente, y para plantilla inexistente, no vigente o no aplicable (cubierto por el test plan)
- [ ] Recorrido de rutas: rechazado al importar y comprobado al descargar (test)
- [ ] Cabeceras de descarga: `nosniff`, `attachment`, `private, no-store`
- [ ] Actor desde la sesión en todas las escrituras
- [ ] Versión por cada cambio del catálogo, en la misma transacción
- [ ] Sin variables de entorno nuevas
- [ ] Migración aplicada en producción antes de fusionar
- [ ] Trazado de binarios verificado en build y en preview

## Open Questions

Ninguna.
