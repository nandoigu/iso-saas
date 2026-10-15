# ADR-016: Catálogo de plantillas documentales — binarios en la función y carga por subida desde /admin

## Status

Accepted

## Date

2026-10-13

## Context

La funcionalidad «Documentación de justificación por proyecto» (diseño del 12-oct, spec `docs/component-specs/documentacion-justificacion.md`) se construye en dos entregas. La entrega 1 es el catálogo visible: tabla `DocumentTemplate`, importador del libro, descarga autenticada de la plantilla y sección «Documentación». La entrega 2 es la justificación: subida, PDF, vínculos, estado y dossier.

El diseño dejó cinco cuestiones para este ADR. Dos bloquean la entrega 1 y se cierran aquí. Las otras tres son de la entrega 2 y quedan **planteadas con datos verificados**, sin decidir.

Hechos verificados el 2026-10-13:

| Hecho | Fuente |
|---|---|
| Las 28 plantillas están en git (`docs/fuentes/plantillas-iso/`, 5,3 MB) y no hay `.vercelignore`, así que llegan al build de Vercel | `git ls-files`, raíz del repo |
| La mayor plantilla del catálogo pesa 1,16 MB (`PLANTILLA-LOIN-V01.xlsx`) | `ls -lS` |
| Next 16 incluye ficheros en la traza de una ruta con `outputFileTracingIncludes`: claves = glob de ruta (picomatch), valores = glob desde la raíz del proyecto. No afecta a rutas Edge ni a páginas estáticas | `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md` |
| Vercel indica que `includeFiles` de `vercel.json` **no se admite en Next.js** y remite a `outputFileTracingIncludes` | vercel.com/docs/functions/limitations |
| El proyecto ya usa ese mecanismo para `pdfkit` | `next.config.js` |
| Límite de cuerpo de petición **y de respuesta** de una función: **4,5 MB** (413 `FUNCTION_PAYLOAD_TOO_LARGE`) | vercel.com/docs/functions/limitations |
| Las respuestas por streaming **no tienen ese límite** | vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions |
| Streaming activo por defecto en todas las funciones Node.js; la documentación no lo restringe por plan | vercel.com/docs/functions/streaming-functions |
| Duración máxima en Hobby: **300 s**, streaming incluido | vercel.com/docs/functions/limitations |
| Tamaño máximo del bundle de una función: 250 MB sin comprimir | vercel.com/docs/functions/limitations |
| El libro del catálogo no está en git: vive en `docs/fuentes/trabajo/` | `git status` |

## BAOS Principles Affected

- **Governance-first**: el catálogo es contenido del experto. Entra solo por el importador, que valida todo o nada y no borra nunca.
- **Security by design**: las plantillas no se publican en `public/`; se sirven por una ruta autenticada y acotada al proyecto.
- **Multi-tenant isolation**: el catálogo es global, pero el acceso se resuelve a través del proyecto; lo ajeno es 404.
- **Evidence-first** (entrega 2): una evidencia apunta a la plantilla de la que sale; por eso la plantilla retirada no se borra.

## Decision

### D1 — Las plantillas viajan en la función de la ruta de descarga (entrega 1)

Los binarios se quedan en `docs/fuentes/plantillas-iso/` (D12 del diseño) y se incluyen en la traza de **dos rutas**: la de descarga y la de importación, que comprueba que cada fichero del libro existe.

```js
outputFileTracingIncludes: {
  "/*": ["./node_modules/pdfkit/js/data/**/*"],
  "/api/projects/\\[id\\]/document-templates/**": ["./docs/fuentes/plantillas-iso/**/*"],
  "/api/admin/document-templates/import": ["./docs/fuentes/plantillas-iso/**/*"],
}
```

Las claves exactas se confirman en el build, leyendo el `.nft.json` de cada ruta. **Un build verde no basta**: si la clave no casa, el build pasa igual y la descarga falla en producción.

La ruta resuelve el fichero **solo a partir de `DocumentTemplate.fichero`**, nunca de un parámetro de la URL, y comprueba que la ruta resultante queda dentro de `plantillas-iso/`.

La respuesta se envía **por streaming** (`fs.createReadStream` convertido a `ReadableStream`). Hoy la mayor plantilla pesa 1,16 MB y cabría sin streaming, pero así el límite de 4,5 MB deja de condicionar qué plantillas puede añadir el experto.

### D2 — El catálogo se carga subiendo el libro desde `/admin` (entrega 1)

Se añade el botón **«Importar catálogo documental»** en `/admin` (decisión del usuario, 13-oct). Llama a una ruta admin que recibe el `.xlsx` con `readSafeXlsxUpload`, igual que `/api/import-templates`. Es la misma vía en local, en Test y en producción, sin consola y sin acceso a la base.

El libro pesa 16 KB, muy por debajo del límite de 4,5 MB de la petición.

### D3 — Reglas del importador (entrega 1)

Fijadas por el usuario el 13-oct:

1. Idempotente por `fichero`. No borra nunca: lo que falta en el libro, o viene con «no», pasa a `vigente = false`.
2. Una referencia se vincula **solo a los roles de su fila en los que existe**. Si no existe para ninguno, la importación falla.
3. Las referencias admiten `;` y `,` como separador y el prefijo «ISO» opcional. La norma se arrastra a las referencias siguientes que no la repiten.
4. Todo o nada, en una transacción.

## Cuestiones abiertas para la entrega 2

No se deciden aquí. Cada una se cierra con un ADR o una enmienda antes de implementar la entrega 2.

### Q1 — El par Word/Excel + PDF

- a) Dos `EvidenceItem` hermanos: no cambia el esquema, pero hay que modelar el parentesco (un campo nuevo o una convención).
- b) Una evidencia con dos binarios: el modelo actual tiene **un** `sourceRef` y **un** `AnalysisDocument` por evidencia, así que exige cambiar el esquema del Evidence Graph.

### Q2 — Declaración de vínculos en bloque frente a ADR-010

ADR-010 fija que **el acto lo define la ruta**: la ruta del dueño declara (sin validar) y la admin certifica. Un gesto de «Documentación» que declare a la vez todos los requisitos de la plantilla es una declaración del dueño. Hay que fijar que esa ruta **solo declara**, aunque la use un admin (como DECL-09), y que declara únicamente contra requisitos que existan en el proyecto.

### Q3 — Dossier ZIP

Con los datos de arriba hay tres caminos:

- a) Streaming desde la función: sin límite de tamaño, pero cortado a **300 s** en Hobby, y con dossiers que incluyan planos de cientos de MB el riesgo de corte es real.
- b) Generar el ZIP en Blob y entregar una URL firmada: consume cupo del store (1 GB en Hobby) y hereda el problema de borrado de ADR-005.
- c) Montar el ZIP en el navegador a partir de URLs firmadas: no pasa por la función, pero depende de la memoria del navegador.

Pendiente de medir antes de decidir: el tamaño típico de un dossier real.

## Alternatives Considered

### Servir las plantillas desde `public/`

Descartada: quedarían accesibles sin sesión para cualquiera con la URL. El diseño exige ruta autenticada.

### Subir las plantillas a Vercel Blob

Descartada por D12 del diseño (plantillas en el repo). Además ocuparía cupo de Blob y añadiría un paso de sincronización cada vez que el experto cambie una plantilla.

### Cargar el catálogo con un script contra la base

Descartada: exige consola y cadena de conexión de producción, y el clasificador de auto-mode bloquea las escrituras a producción. La ruta admin reutiliza un patrón probado.

### Ignorar referencias que no resuelven

Descartada: una referencia ignorada en silencio es un vínculo normativo que el experto cree haber escrito y no existe.

## Consequences

### Positive

- La entrega 1 no depende de Blob ni de ningún servicio nuevo.
- El experto cambia el catálogo subiendo un Excel, sin despliegue, salvo que añada un binario nuevo.
- El streaming quita el techo de 4,5 MB a las plantillas.

### Negative

- **Una plantilla nueva exige commit y despliegue**: el binario va en el repo. Si se añade la fila al libro antes de desplegar el fichero, el importador la rechaza.
- Los 5,3 MB de plantillas se suman al bundle de dos funciones (muy lejos de los 250 MB).

### Risks

- **La clave de `outputFileTracingIncludes` no casa con la ruta.** El build no avisa. Mitigación: comprobar el `.nft.json` tras el build y probar la descarga en el despliegue de preview antes de fusionar.
- **Recorrido de rutas.** Mitigación: el nombre sale de la base, nunca de la URL, y se comprueba que la ruta final queda dentro de `plantillas-iso/`.

## BAOS Architecture Alignment

Implementa un módulo del **Evidence Graph** sin rediseñarlo: el catálogo es una tabla nueva y la única extensión prevista del modelo existente (entrega 2) es una columna anulable en `EvidenceItem`. No introduce automatismos sobre conclusiones de auditoría ni toca la valoración del auditor. La cuestión Q1 b) sí cambiaría el modelo del Evidence Graph y, si se elige, requiere su propio ADR.

## Related ADRs

- ADR-003: Evidence Graph Phase 1 Scoping Decisions — el catálogo global sigue el patrón de `RequirementTemplate`.
- ADR-004: Evidence Graph Implementation Decisions — subida por client upload y convención de rutas `/api/admin/`.
- ADR-005: Ciclo de cierre de auditoría — afecta a Q3 b).
- ADR-010: Vínculo declarado y validado — gobierna Q2.
- ADR-014: Acceso privado del store — aplica a la subida de la entrega 2.
- ADR-015: Guarda aproximada de la cita — admite evidencias sin vínculos (documentos administrativos).
