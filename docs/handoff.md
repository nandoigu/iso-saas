# Handoff de proyecto

## Proyecto

- Nombre: `BMO ISO 19650`
- Stack: `Next.js App Router`, `TypeScript`, `Prisma`, `SQL`, `Resend`
- Ruta local del repo: `C:\Users\ferna\prueba-app`

## Estado actual

La aplicacion ya tiene una base SaaS funcional bastante avanzada.

### Funcionalidades principales ya operativas

- registro, login, logout y sesion
- roles `admin` y `user`
- estados de usuario `active`, `suspended`, `blocked`
- perfil de usuario y cambio de contrasena
- forgot password / reset password
- panel admin
- creacion de proyectos
- funcion obligatoria del proyecto:
  - `adjudicador`
  - `adjudicatario_principal`
  - `adjudicatario`
- carga automatica de requerimientos por funcion al crear proyecto
- edicion de metadatos del proyecto:
  - nombre
  - codigo
- importacion de plantillas por rol desde Excel
- importacion especifica de requerimientos por proyecto
- modos de importacion por proyecto:
  - `append`
  - `replace`
- CRUD principal de requerimientos dentro del proyecto
- matriz de cumplimiento independiente
- dashboard BI con:
  - KPIs
  - filtros
  - graficos
  - export CSV/PDF
  - alertas
  - preferencias de notificacion

## Decisiones de producto y arquitectura

### Seguridad / acceso

- cada usuario solo ve y gestiona sus propios proyectos
- no hay colaboracion multiusuario dentro de proyectos
- `admin` puede ver y gestionar globalmente
- `user` tiene limite de `5` proyectos

### Proyecto

- `Project.role` es obligatorio
- `Project.role` se fija al crear el proyecto
- `Project.role` **no se edita despues**
- la funcion del proyecto determina la carga inicial de requerimientos

### Importaciones

- hay dos vias compatibles:
  1. plantillas globales por rol
  2. requerimientos especificos de proyecto
- importacion de proyecto soporta dos formatos Excel:
  - detallado de proyecto
  - plantilla por rol
- importacion de proyecto soporta dos modos:
  - `append`: anade solo nuevos y deduplica
  - `replace`: elimina los actuales del proyecto y carga el Excel

### Email

- Resend esta integrado
- en entorno actual puede haber restricciones de envio si el remitente sigue en modo pruebas (`@resend.dev`)
- el sistema ya devuelve mensajes utiles cuando el proveedor esta en modo test

## Ultimos commits relevantes

- `0417402` Unify app notice messages
- `967e8a2` Improve responsive compliance views and notices
- `f6f8607` Replace vulnerable xlsx dependency
- `d6956ba` Add project handoff document
- `d86be68` Clarify project import append and replace modes
- `c53ebd5` Harden project and requirement validations
- `08b07e8` Polish project operations and editing flows
- `d2f014d` Clarify password reset email test-mode behavior
- `d875a46` Harden email delivery feedback and cleanup
- `12dea58` Normalize role and project requirement imports

## Auditoria funcional: estado

### Ya revisado y validado

- flujo principal de proyecto:
  - crear proyecto
  - editar proyecto
  - crear requerimiento
  - editar requerimiento
  - borrar requerimiento
  - borrar proyecto
- importacion por proyecto:
  - `append`
  - `replace`
- consistencia entre dashboard y matriz despues de editar o reimportar
- logout y login posterior
- validaciones principales de proyecto y requerimiento
- dashboard funcional por API:
  - metricas
  - filtros base
  - preferencias de notificacion
  - envio manual con error claro cuando Resend esta limitado
- matriz de cumplimiento:
  - consistencia de datos frente al dashboard
  - comportamiento responsive inicial
- panel admin:
  - acceso permitido para `admin`
  - acceso denegado para `user`
  - gestion global de usuarios y proyectos
- flujos destructivos principales:
  - borrado de requerimientos
  - borrado de proyectos
  - borrado admin de usuarios/proyectos
- flujos de recuperacion:
  - forgot password
  - reset password
  - limpieza de tokens cuando falla el email

### Hallazgos ya corregidos

- cookies de sesion antiguas tras cambio de `AUTH_SECRET`:
  - login vuelve a ser accesible aunque exista una cookie invalida
  - home/dashboard/projects limpian sesion y redirigen a login en `401/403`
- incompatibilidad entre Excel por rol y Excel por proyecto
- errores opacos en envio manual de informes
- tokens de reset huerfanos cuando fallaba el email
- validaciones flojas en `requirements`
- ausencia de modos explicitos de reimportacion en proyectos vivos
- sustitucion de `xlsx` por `exceljs` manteniendo archivos `.xlsx` para usuarios
- vulnerabilidad `postcss` mitigada con `overrides` a `postcss@8.5.14`
- responsive real en:
  - `app/projects/page.tsx`
  - `app/projects/[id]/ProjectClient.tsx`
  - `app/projects/[id]/ProjectMatrixClient.tsx`
  - `components/ComplianceMatrix.tsx`
- mensajes de error/exito homogeneizados con `components/Notice.tsx`
- avisos locales de dashboard y admin sustituidos por el componente comun

## Plan de trabajo actualizado

### Completado

- [x] Auditar flujo principal de proyecto end-to-end.
- [x] Corregir importaciones Excel para soportar plantilla por rol y Excel de proyecto.
- [x] Mantener compatibilidad de usuario con archivos `.xlsx`.
- [x] Eliminar dependencia vulnerable `xlsx` y migrar parsing interno a `exceljs`.
- [x] Mitigar vulnerabilidad `postcss` sin esperar fix upstream de Next/Tailwind.
- [x] Endurecer validaciones de proyectos y requerimientos.
- [x] Hacer explicitos los modos de reimportacion `append` y `replace`.
- [x] Mejorar feedback de email/reportes cuando Resend esta en modo pruebas.
- [x] Separar matriz de cumplimiento en vista independiente.
- [x] Validar consistencia funcional dashboard/matriz tras editar o reimportar.
- [x] Revisar flujos destructivos principales y recuperacion de cuenta.
- [x] Implementar responsive real en listado de proyectos.
- [x] Implementar responsive real en detalle de proyecto.
- [x] Implementar responsive real inicial en matriz de cumplimiento.
- [x] Homogeneizar mensajes de error/exito/info/warning con `components/Notice.tsx`.
- [x] Pulir vista de detalle de proyecto:
  - jerarquia visual
  - formularios de alta/edicion
  - filtros y ordenacion
  - tarjetas de requerimientos
  - navegacion entre alta, importacion, filtros, listado y matriz
- [x] Revisar seguridad/produccion:
  - sesiones y cookies
  - middleware/proxy y protecciones API
  - comportamiento `blocked` y `suspended`
  - variables de entorno
  - estado de migraciones Prisma/base de datos
- [x] Pasada funcional de dashboard por HTTP/API:
  - fuente de datos
  - preferencias
  - envio manual con Resend limitado
- [x] Pasada funcional de matriz por HTTP/API.
- [x] Pasada funcional de admin con datos ajenos temporales:
  - cambio de estado
  - bloqueo
  - borrado de proyecto
  - borrado de usuario
- [x] Corregir manejo de cookies de sesion invalidas tras endurecer `AUTH_SECRET`.
- [x] Responsive en vistas secundarias de auth/perfil/email-test:
  - `app/profile/page.tsx`
  - `app/login/page.tsx`
  - `app/register/page.tsx`
  - `app/forgot-password/page.tsx`
  - `app/reset-password/page.tsx`
  - `app/dashboard/email-test/page.tsx`
- [x] Responsive en panel admin:
  - cabecera adaptable
  - secciones apilables
  - tablas con scroll horizontal estable
  - controles de accion sin solapes
- [x] Guardar en git los bloques previos ya cerrados.

### Prioridad alta pendiente

- [ ] Verificacion de produccion de email:
  - verificar dominio real en Resend
  - configurar `EMAIL_FROM` definitivo
  - repetir prueba real de envio a usuarios no autorizados en modo test
- [ ] Revision de seguridad y produccion:
  - revisar logs de errores
  - revisar rotacion/gestion real de secretos en el entorno de despliegue
- [ ] Auditoria visual completa en navegador cuando el runtime permita probar formularios con `type=email` sin bloqueo.
- [ ] Repetir una pasada UI manual sobre dashboard:
  - filtros desde interfaz
  - export CSV desde interfaz
  - export PDF desde interfaz
  - preferencias de notificacion desde interfaz
- [ ] Repetir una pasada UI manual sobre matriz:
  - filtros
  - agrupaciones
  - scroll horizontal en movil
  - lectura en tablet/escritorio
- [ ] Repetir una pasada UI manual sobre admin con datos ajenos:
  - cambio de rol desde interfaz
  - cambio de estado desde interfaz
  - borrado de usuario desde interfaz
  - borrado de proyecto desde interfaz

### Prioridad media pendiente

- [ ] Unificación visual restante:
  - [x] primera pasada de estilos compartidos para botones, paneles, campos, ayudas y estados vacíos en vistas operativas principales
  - [x] badges de usuario/estado centralizados en `components/uiStyles.ts`
  - [x] tablas principales conectadas a estilos compartidos en admin y matriz
  - [x] confirmaciones destructivas homogeneizadas en proyectos, detalle y admin
  - botones
  - badges
  - paneles
  - tablas
  - estados vacíos
  - confirmaciones destructivas
- [ ] Unificar avisos restantes si aparecen nuevos patrones fuera de `components/Notice.tsx`.
- [x] Revisar textos con falta de acentos o restos de mojibake heredados en UI y mensajes API principales.
- [x] Documentar formato de importación Excel para usuario final:
  - columnas aceptadas
  - modos `append` / `replace`
  - errores habituales y cómo corregirlos
  - referencia interna: `docs/excel-import-format.md`
  - ayuda visible en importación global y en importación por proyecto
- [ ] Mejora de productividad del usuario:
  - búsquedas más útiles
  - filtros más potentes
  - ordenación persistente o más visible
  - accesos rápidos
  - acciones en contexto
  - persistencia de algunos filtros
  - mejor navegación entre proyecto, matriz y dashboard
- [ ] Alertas e informes:
  - verificar envíos de alertas en escenarios reales tras configurar Resend
  - mejorar contenido del email
  - revisar frecuencia y duplicados
  - comprobar flujos manuales vs cron
  - mejorar presentación del PDF/CSV

### Prioridad baja / preparación futura

- [ ] Preparar checklist de despliegue:
  - variables de entorno
  - migraciones Prisma
  - build
  - smoke test post-deploy
- [ ] Revisar accesibilidad básica:
  - labels
  - foco visible
  - navegación por teclado
  - contraste
- [ ] Onboarding y primera experiencia:
  - vacíos guiados
  - ayuda contextual ligera
  - primera creación de proyecto más acompañada
  - sugerencias de siguiente paso
- [ ] Branding y presencia comercial:
  - copy mas consistente
  - pulido visual final
  - datos demo de calidad
  - cuenta demo
  - presentación comercial del producto
- [ ] Evolución funcional futura:
  - histórico de cambios
  - comentarios o notas por requerimiento
  - versionado de plantillas
  - exportaciones más ricas
  - comparativas entre proyectos
  - métricas por empresa
- [ ] Evaluar tests automatizados de humo para APIs principales.
- [ ] Revisar si conviene extraer más estilos compartidos después de cerrar responsive.

### Quick wins pendientes

- [x] Terminar el pulido de la vista de detalle del proyecto.
- [x] Revisar mensajes de error/exito para que sean consistentes.
- [ ] Homogeneizar botones, badges, paneles y tablas en toda la app.
- [ ] Añadir mejor feedback al guardar, editar e importar donde aún falte.
- [ ] Preparar un recorrido de prueba completo con un usuario demo.

### Riesgos y notas abiertas

- La verificacion visual completa en navegador sigue limitada por el runtime al escribir en campos `type=email`.
- La ultima pasada de prioridad alta esta documentada en `docs/high-priority-audit-2026-05-10.md`.
- Por API, los flujos funcionales criticos revisados estan pasando.
- Resend sigue dependiendo de configuracion externa de dominio para envios reales a cualquier destinatario.
- `npm audit --audit-level=moderate` paso limpio tras la mitigacion de `postcss`.
- El plan actualizado queda alineado con el plan anterior: la vista de proyecto vuelve a prioridad alta, y las mejoras de productividad, alertas/informes, onboarding, branding, evolucion futura y quick wins quedan reflejadas sin duplicar tareas ya completadas.

## Recomendacion para retomar en un chat nuevo

Cuando se abra un chat nuevo dentro del proyecto:

1. indicar que el repo base es `C:\Users\ferna\prueba-app`
2. decir que el estado de referencia esta en este archivo:
   - `docs/handoff.md`
3. empezar por:
   - "continuamos con el plan de trabajo actualizado desde `docs/handoff.md`"

## Comandos utiles

```powershell
cd C:\Users\ferna\prueba-app
npm run dev
```

App local habitual:

- [http://localhost:3000](http://localhost:3000)

## Nota final

La base funcional del producto ya esta bien montada. El siguiente trabajo recomendado no es abrir muchas piezas nuevas, sino cerrar bien auditoria, robustez y preparacion de produccion.
