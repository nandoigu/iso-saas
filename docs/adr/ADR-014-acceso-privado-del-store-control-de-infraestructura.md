# ADR-014: El acceso privado del binario de evidencia es un control de infraestructura, no de código

## Status

Accepted

## Date

2026-08-16

## Context

La Fase D del Evidence Graph implementó el flujo de subida decidido en ADR-004 #3: **client upload directo al store**, autorizado por un token que emite el servidor. El binario no atraviesa la función serverless.

Al implementarlo contra `@vercel/blob@2.8.0` apareció una propiedad del handshake que ninguna especificación anterior anticipaba:

> **En el handshake clásico de client upload, el `access` del fichero lo declara el CLIENTE en su llamada a `upload()`.** El callback de autorización del servidor (`onBeforeGenerateToken`) recibe `pathname`, `clientPayload` y `multipart`, y devuelve restricciones de tamaño, tipo y sufijo. **Entre ellas no está `access`.** El servidor no puede forzar que la evidencia se almacene como privada.

Esto choca de frente con ADR-003 decisión #1, que exige que el binario se sirva **exclusivamente** vía signed URL de corta duración y **nunca** como URL pública. Un cliente modificado podría pedir `access: 'public'` y dejar un documento de auditoría accesible por URL permanente.

Verificado empíricamente contra el store real `iso-saas-evidence-fra` (`scripts/probar-blob-fase-d.mjs`, 2026-08-16): el intento **es rechazado**, pero no por nuestro código ni por el token, sino por el propio store:

```
Vercel Blob: Cannot use public access on a private store.
The store is configured with private access.
```

Es decir: **la garantía existe, pero vive en una propiedad de configuración de un recurso externo al repositorio.** No la impone el código, no la expresa el contrato, y **ningún test la cubre**. Los 105 tests de la suite seguirían en verde si esa propiedad desapareciera.

El motivo por el que esto es una decisión y no un simple hallazgo es que existe una alternativa técnica real que trasladaría la garantía al código, y hay que elegir conscientemente entre las dos.

## BAOS Principles Affected

- **Security by design** — es el principio central de esta decisión. La protección de un documento confidencial de cliente depende de una casilla de configuración de infraestructura, no de un control verificable en el repositorio. Aceptarlo exige declararlo, no ocultarlo.
- **Evidence-first** — el binario es el soporte material de la evidencia. Una copia pública permanente de un documento de auditoría contamina la cadena de custodia aunque el registro en base de datos sea correcto.
- **Governance-first** — una garantía cuyo modo de fallo es silencioso y cuyo disparador de revisión no está escrito es una garantía no gobernada.
- **Certification-ready** — ante un auditor externo hay que poder señalar **dónde** vive cada control. "Lo impone el proveedor de almacenamiento" es una respuesta admisible solo si está documentada y es verificable a demanda.

## Decision

**Se acepta que el acceso privado del binario sea un control de infraestructura**, y se compensa su invisibilidad con tres obligaciones explícitas:

1. **Declaración en el contrato.** El api-contract del Evidence Graph y su security-spec recogen que el `access` no lo decide el endpoint, que la garantía la impone el store, y que **un store creado sin acceso privado dejaría la ruta desprotegida**.

2. **Disparador de revisión escrito.** Toda sustitución, recreación o migración del store de evidencias obliga a verificar la propiedad de acceso privado **antes** de dar la protección por buena. Se une a la lista de propiedades de recurso inmutables o críticas que este proyecto ya arrastra: la región de Neon (ADR-007) y la región del store de Blob.

3. **Sonda ejecutable contra el recurso real.** `scripts/probar-blob-fase-d.mjs` verifica, contra el store de producción y creando y borrando sus propios ficheros: URL privada sin firmar → 403 · signed URL → 200 con el contenido correcto · signed URL caducada → 403 · `access: 'public'` rechazado por el store · token de subida acotado al pathname del proyecto. Es el único mecanismo que puede volver a comprobar lo que los tests no ven.

**Segundo control, independiente y sí en código**: el token de subida queda acotado al `pathname` por el propio SDK (`Pathname mismatch` al intentar otra ruta), además de la comprobación de prefijo `evidence/{projectId}/` en `onBeforeGenerateToken`. La atribución de un binario a su proyecto tiene por tanto doble cierre; la privacidad, uno solo.

Toda la interacción con el store se concentra en `services/evidence-storage.service.ts`, único módulo autorizado a importar `@vercel/blob` — mismo criterio que `services/ai-provider.ts` para la inferencia. Es lo que hace que el día que la decisión se revise, el cambio sea un fichero y no una búsqueda por el árbol.

## Alternatives Considered

### A. `handleUploadPresigned` + `presignUrl` — trasladar el `access` al servidor

El SDK ofrece un segundo flujo de client upload en el que el servidor emite una **URL presignada de escritura** (`issueSignedToken` + `presignUrl({ operation: 'put', access: 'private', … })`). Ahí `access` **sí** es un argumento del lado servidor y entra en la cadena firmada: el cliente no puede alterarlo sin invalidar la firma. Sería la garantía en código, comprobable con un test, y además unificaría subida y lectura sobre la misma primitiva.

Descartada **por ahora**, por tres motivos:

1. **No elimina el riesgo, lo reduce.** El store seguiría admitiendo escrituras públicas por cualquier otra vía que use el token de lectura-escritura. El control de infraestructura seguiría siendo la última línea; dejaría de ser la única.
2. **Obliga al cliente a usar `uploadPresigned` en lugar del `upload()` documentado.** En este proyecto **todavía no existe UI de Evidence Graph**, así que la elección no está forzada por código existente — pero sí ataría la interfaz futura a la ruta menos documentada del paquete, con menos ejemplos y más superficie de cambio.
3. **El coste de cambiar más adelante es bajo y está acotado**: un solo fichero, `services/evidence-storage.service.ts`, y la interfaz aún no escrita.

**Disparador para reconsiderarla**: el primer documento real de cliente en el store, o la construcción de la UI de subida — lo que ocurra antes. En ese momento la decisión se toma con la interfaz delante y no en abstracto.

### B. Subir el binario a través de la función serverless

Con el binario pasando por la función, el servidor llamaría a `put(..., { access: 'private' })` y el `access` sería suyo por completo. Es la garantía más fuerte posible.

Descartada porque **contradice ADR-004 #3**, que sacó deliberadamente el binario de la función. El motivo original (límite de ~4,5 MB de body) se ha relajado —hoy 100 MB—, pero los planos BIM pueden superar ese tamaño y el flujo perdería la subida directa, la multiparte y el progreso. Revertir una decisión de arquitectura para ganar un control que el store ya impone es un intercambio malo.

### C. Verificar el `access` después de la subida y borrar lo que salga público

Comprobar con `head()` el acceso resultante y borrar el blob si no es privado. Descartada por dos razones: la comprobación ocurre **después** de que el fichero exista (la ventana ya se ha abierto), y depende de un borrado activo — exactamente el mecanismo que ADR-008 D5 rechazó al descartar la Files API, porque **un borrado fallido no avisa**.

## Consequences

### Positive

- La garantía queda **declarada** en lugar de supuesta. Ante un pliego o un auditor se puede señalar dónde vive el control y cómo se comprueba.
- Existe una comprobación **ejecutable** contra el recurso real, no una afirmación en un documento.
- El disparador de revisión está escrito, así que la próxima sustitución del store no depende de que alguien recuerde este detalle.
- La atribución del binario a su proyecto conserva doble cierre (código + token del SDK).

### Negative

- **Se acepta un control que la suite de tests no puede cubrir.** Es una excepción consciente al criterio general del proyecto de verificar en tests todo lo que importa.
- El proyecto suma una cuarta propiedad de recurso externo que hay que vigilar a mano (región de Neon, región del store, acceso del store, y ahora el vínculo entre las tres y el token en las tres superficies de Vercel).
- La sonda solo protege si alguien la ejecuta. No hay nada que la dispare automáticamente.

### Risks

- **Sustitución del store sin verificar la propiedad.** Mitigación: declarado en security-spec, api-contract, este ADR y la memoria de proyecto. Sin mitigación automática.
- **Cambio de comportamiento del proveedor.** Si Vercel permitiera en el futuro blobs públicos dentro de un store privado, la protección caería sin aviso ni cambio por nuestra parte. Mitigación: la sonda lo detectaría, pero solo al ejecutarse. Este riesgo es el argumento más fuerte a favor de la alternativa A, y la razón de que se deje con disparador explícito en vez de descartada.
- **Falsa sensación de cobertura**: leer "105/105 tests en verde" puede interpretarse como que la privacidad de las evidencias está probada. No lo está. Consignado aquí para que quede en el registro.

## BAOS Architecture Alignment

Compatible con la arquitectura congelada. Esta decisión **implementa** el Evidence Graph, no lo rediseña: materializa el acceso al binario que ADR-003 #1 y ADR-004 #3 ya habían fijado, y no altera ninguna frontera de componente, entidad ni contrato funcional.

No introduce aprendizaje autónomo, no elimina ningún punto de control humano, no toca el aislamiento multi-tenant —el corte por `Project.userId` ocurre en el handler, antes de firmar nada— y no sustituye ningún Core Component por una versión simplificada.

Sí **acota** el alcance de una afirmación de seguridad: la privacidad del binario no es una propiedad del código de BAOS. Se documenta en vez de darse por implícita, que es lo que exige *governance-first*.

## Related ADRs

- **ADR-003**: Evidence Graph Phase 1 Scoping Decisions — su decisión #1 (signed URL de corta duración, nunca URL pública) es la exigencia que esta decisión se compromete a sostener.
- **ADR-004**: Evidence Graph Implementation Decisions — su decisión #3 (client upload directo al store) es la que crea la situación: el `access` queda del lado del cliente precisamente porque el binario no pasa por el servidor.
- **ADR-007**: Ubicar datos y cómputo en Frankfurt — mismo patrón de riesgo: una propiedad de recurso externo, inmutable, invisible para los tests.
- **ADR-008**: Audit Intelligence Platform — su decisión D5 descartó el borrado activo por el mismo motivo que aquí se descarta la alternativa C: un borrado fallido no avisa.
