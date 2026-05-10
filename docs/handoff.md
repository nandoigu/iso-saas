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

- `d86be68` Clarify project import append and replace modes
- `c53ebd5` Harden project and requirement validations
- `08b07e8` Polish project operations and editing flows
- `d2f014d` Clarify password reset email test-mode behavior
- `d875a46` Harden email delivery feedback and cleanup
- `12dea58` Normalize role and project requirement imports
- `60cdd6f` Refresh core app UX surfaces
- `2f04378` Require project role and auto-generate requirements

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

### Hallazgos ya corregidos

- incompatibilidad entre Excel por rol y Excel por proyecto
- errores opacos en envio manual de informes
- tokens de reset huerfanos cuando fallaba el email
- validaciones flojas en `requirements`
- ausencia de modos explicitos de reimportacion en proyectos vivos

## Pendientes claros

### Prioridad alta

1. seguir con la auditoria funcional completa end-to-end
2. revisar mas a fondo:
   - comportamiento de filtros y exportaciones en dashboard desde la UI
   - consistencia visual y funcional de la matriz en uso real
   - escenarios de admin sobre datos ajenos desde interfaz
3. revisar endurecimiento para produccion:
   - dominio real verificado en Resend
   - `EMAIL_FROM` de produccion
   - revisar dependencia vulnerable pendiente si sigue presente

### Prioridad media

- responsive real en:
  - `app/projects/page.tsx`
  - otras vistas principales
- seguir puliendo UX de detalle de proyecto
- homogeneizar mensajes de error y exito en toda la app

## Tarea responsive pendiente ya acordada

Pendiente para mas adelante:

- adaptar `app/projects/page.tsx` a responsive real
  - 2 columnas comodas en escritorio
  - 1 columna en movil
  - comportamiento intermedio limpio en tablet

## Recomendacion para retomar en un chat nuevo

Cuando se abra un chat nuevo dentro del proyecto:

1. indicar que el repo base es `C:\Users\ferna\prueba-app`
2. decir que el estado de referencia esta en este archivo:
   - `docs/handoff.md`
3. empezar por:
   - "continuamos la auditoria funcional end-to-end desde `docs/handoff.md`"

## Comandos utiles

```powershell
cd C:\Users\ferna\prueba-app
npm run dev
```

App local habitual:

- [http://localhost:3000](http://localhost:3000)

## Nota final

La base funcional del producto ya esta bien montada. El siguiente trabajo recomendado no es abrir muchas piezas nuevas, sino cerrar bien auditoria, robustez y preparacion de produccion.
