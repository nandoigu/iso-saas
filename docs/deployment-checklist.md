# Checklist de despliegue

## Objetivo

Checklist operativo para desplegar APP-ISO19650/BMO ISO 19650 en Vercel sin olvidar variables, migraciones ni pruebas de humo.

## Antes de desplegar

- Confirmar rama objetivo: `main`.
- Confirmar arbol limpio:

```powershell
git status --short
```

- Ejecutar lint:

```powershell
cmd /c npm run lint
```

- Ejecutar build local si hay cambios de dependencias, Prisma o rutas criticas:

```powershell
cmd /c npm run build
```

- Revisar si hay migraciones nuevas en `prisma/migrations`.
- Si hay migraciones nuevas, aplicarlas en produccion con el `DATABASE_URL` de Neon correspondiente:

```powershell
npx prisma migrate deploy
```

## Variables de entorno obligatorias

En Vercel deben existir estas variables para Production:

- `DATABASE_URL`
- `APP_URL`
- `AUTH_SECRET`
- `JWT_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `CRON_SECRET`

Recomendaciones:

- `APP_URL` debe apuntar al dominio publico de la app.
- `EMAIL_FROM` debe usar el dominio verificado en Resend, por ejemplo `BMO ISO 19650 <no-reply@eficax.com>`.
- `CRON_SECRET` local y de Vercel deben coincidir si se quiere lanzar manualmente `/api/cron/alerts` desde consola.
- No guardar secretos reales en documentacion ni en git.

## Configuracion Vercel

- Build command esperado:

```powershell
prisma generate && next build
```

- Cron configurado en `vercel.json`:

```json
{
  "path": "/api/cron/alerts",
  "schedule": "0 8 * * *"
}
```

## Smoke test post-deploy

1. Abrir la app publica.
2. Login con usuario admin controlado.
3. Confirmar que la home muestra KPIs sin errores.
4. Abrir Proyectos y comprobar que se listan proyectos existentes.
5. Crear un proyecto de prueba y verificar que carga requerimientos base segun funcion.
6. Abrir detalle de proyecto y validar:
   - alta manual de requerimiento
   - filtros
   - matriz del proyecto
7. Abrir Dashboard y validar:
   - filtros
   - export CSV
   - export PDF
   - preferencias de notificacion
8. Abrir Matriz y validar:
   - busqueda
   - filtro por norma
   - checkboxes de estado
   - export Excel/PDF
9. Abrir Admin y validar con datos no criticos:
   - cambio de rol reversible
   - cambio de estado reversible
   - proteccion de la propia cuenta admin
10. Probar email:
    - forgot password con destinatario controlado
    - informe manual desde dashboard
    - alerta de vencimiento con `dryRun=1` antes del envio real si se va a disparar el cron manualmente

## Cron de alertas

Diagnostico sin envio:

```powershell
Invoke-RestMethod `
  -Uri "https://APP_URL/api/cron/alerts?dryRun=1" `
  -Headers @{ Authorization = "Bearer CRON_SECRET" }
```

Envio real:

```powershell
Invoke-RestMethod `
  -Uri "https://APP_URL/api/cron/alerts" `
  -Headers @{ Authorization = "Bearer CRON_SECRET" }
```

Comprobaciones esperadas:

- `success: true`
- `emailFailures: 0`
- `dryRun: true` no envia ni actualiza deduplicacion.
- una segunda ejecucion real el mismo dia no debe reenviar las mismas alertas.

## Recuperacion rapida

- Si login falla tras cambiar secretos, limpiar cookies del navegador y revisar `AUTH_SECRET`/`JWT_SECRET`.
- Si Prisma falla en Vercel, revisar que el build ejecuta `prisma generate`.
- Si faltan tablas, aplicar `npx prisma migrate deploy` contra Neon.
- Si email falla, revisar `RESEND_API_KEY`, `EMAIL_FROM`, dominio verificado y logs de Vercel.
- Si el cron devuelve `401`, revisar `CRON_SECRET` y el header `Authorization`.
