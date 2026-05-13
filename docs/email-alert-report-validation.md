# Validacion de emails reales de alertas e informes

## Objetivo

Comprobar en produccion que Resend envia correctamente:

- informe manual desde dashboard
- alertas automaticas del cron
- informes periodicos del cron

La comprobacion debe validar tambien frecuencia, deduplicacion y contenido recibido.

## Variables necesarias

- `RESEND_API_KEY`
- `EMAIL_FROM` con dominio verificado, por ejemplo `BMO ISO 19650 <no-reply@eficax.com>`
- `CRON_SECRET`
- `DATABASE_URL`
- `APP_URL`

## Flujo seguro recomendado

1. Crear o elegir un usuario activo con email real controlado.
2. Activar sus preferencias:
   - alertas: activadas
   - informes: activados
   - frecuencia: diaria o semanal segun la prueba
3. Crear un proyecto de prueba con al menos:
   - un requerimiento vencido con estado `parcial` o `no_conforme`
   - un requerimiento con fecha dentro de los proximos 7 dias
   - un requerimiento `total` vencido para confirmar que no dispara alerta
4. Ejecutar primero el diagnostico del cron sin envio:

```powershell
Invoke-RestMethod `
  -Uri "https://APP_URL/api/cron/alerts?dryRun=1" `
  -Headers @{ Authorization = "Bearer CRON_SECRET" }
```

5. Confirmar que la respuesta incluye:
   - `success: true`
   - `dryRun: true`
   - `alertEmailsReady` mayor que `0`
   - `alertRequirementsReady` con los vencidos/proximos esperados
   - `reportEmailsReady` mayor que `0` si los informes estan activados y toca frecuencia
   - `emailsSent: 0`
6. Ejecutar el cron real solo cuando el diagnostico sea correcto:

```powershell
Invoke-RestMethod `
  -Uri "https://APP_URL/api/cron/alerts" `
  -Headers @{ Authorization = "Bearer CRON_SECRET" }
```

7. Confirmar recepcion en el buzon real:
   - asunto de alertas con conteo de vencidos y proximos
   - secciones separadas de vencidos y proximos
   - proyecto, norma, item, estado y fecha limite correctos
   - informe con KPIs de cumplimiento y tabla de requerimientos relevantes
8. Repetir el cron el mismo dia:
   - no debe reenviar las mismas alertas
   - no debe duplicar informe si no corresponde por frecuencia

## Reglas funcionales actuales

- El cron procesa solo usuarios con `status = active`.
- Las alertas se envian como maximo una vez al dia por usuario.
- Cada requerimiento alertado guarda `lastNotifiedAt`.
- Un requerimiento `total` no cuenta como vencido o proximo.
- El informe manual desde dashboard no altera `lastReportEmailAt`; sirve para envio bajo demanda.
- `dryRun=1` no envia emails ni actualiza fechas de deduplicacion.

## Resultado de validacion real - 2026-05-13

- Prueba ejecutada contra endpoint local de Next con base Neon y Resend reales.
- El intento directo contra Vercel con el `CRON_SECRET` local devolvio `401`; revisar/alinear secreto local si se quiere lanzar manualmente el cron de produccion desde consola.
- Para aislar la prueba se desactivaron temporalmente las notificaciones de otros usuarios y se restauraron al finalizar.
- Se creo un proyecto temporal con:
  - un requerimiento vencido `no_conforme`
  - un requerimiento proximo `parcial`
  - un requerimiento vencido `total`
- Resultado corregido:
  - `dryRun`: 1 usuario procesado, 1 email de alerta preparado, 2 requerimientos alertables, 0 fallos.
  - envio real: 1 email enviado, 1 alerta enviada, 2 requerimientos alertables, 0 fallos.
  - segunda ejecucion: 0 emails enviados y 0 requerimientos listos por deduplicacion diaria.
- Hallazgo corregido: el cron incluia requerimientos `total` al calcular alertas; ahora se excluyen antes de clasificar vencidos o proximos.
- Recepcion confirmada por el usuario en Outlook el 13 de mayo de 2026.
- Nota: el email de prueba local puede aparecer desde `onboarding@resend.dev` si `.env.local` usa ese remitente; produccion debe usar `EMAIL_FROM` con el dominio verificado.

## Senales de fallo a revisar

- `401`: falta o no coincide `Authorization: Bearer CRON_SECRET`.
- `emailFailures > 0`: revisar logs de Vercel para el usuario concreto.
- Error de proveedor restringido: revisar dominio verificado y `EMAIL_FROM`.
- `alertEmailsReady = 0` con datos esperados: revisar fechas, estados y `lastNotifiedAt`.
- `reportEmailsReady = 0`: revisar `notifyReports`, `reportFrequency` y `lastReportEmailAt`.
