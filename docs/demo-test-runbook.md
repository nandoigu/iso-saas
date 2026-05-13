# Recorrido de prueba con usuario demo

## Objetivo

Guion para validar la app de extremo a extremo con datos controlados, sin tocar informacion real ni depender de proyectos de trabajo.

## Datos recomendados

- Usuario demo admin:
  - email: `demo-admin@example.com`
  - rol: `admin`
  - estado: `active`
- Usuario demo normal:
  - email: `demo-user@example.com`
  - rol: `user`
  - estado: `active`
- Proyecto demo:
  - nombre: `DEMO ISO 19650`
  - codigo: `DEMO-ISO-19650`
  - funcion: `Adjudicatario principal`

No guardar contrasenas reales en este documento. Si se crean usuarios demo en produccion, usar contrasenas temporales y rotarlas/eliminarlas tras la prueba.

## Preparacion

1. Confirmar que la app publica abre correctamente.
2. Confirmar que hay un usuario admin disponible.
3. Si se va a probar email real, usar un destinatario controlado.
4. Si se va a probar el cron manual, confirmar `CRON_SECRET` antes con `dryRun=1`.
5. Preparar un Excel pequeno de prueba si se va a validar importacion por proyecto.

## Recorrido admin

1. Iniciar sesion como admin.
2. Abrir `Admin`.
3. Confirmar que la propia cuenta admin aparece protegida ante acciones destructivas.
4. Crear o localizar un usuario demo normal.
5. Cambiar su estado:
   - `active -> suspended`
   - `suspended -> active`
6. Cambiar su rol:
   - `user -> admin`
   - `admin -> user`
7. Crear un proyecto demo asociado al usuario demo.
8. Borrar el proyecto demo desde admin.
9. Borrar el usuario demo si la prueba ya ha terminado.

## Recorrido usuario

1. Iniciar sesion como usuario demo.
2. Crear proyecto `DEMO ISO 19650`.
3. Confirmar que la app carga requerimientos base segun la funcion seleccionada.
4. Editar nombre y codigo del proyecto.
5. Crear un requerimiento manual:
   - norma: `19650-1`
   - item: `DEMO-1`
   - estado: `No conforme`
   - fecha limite: manana o dentro de 7 dias
6. Editar el requerimiento:
   - cambiar evidencia
   - cambiar estado a `Parcial`
   - actualizar fecha limite
7. Usar filtros y ordenacion en detalle de proyecto.
8. Abrir matriz del proyecto desde el detalle.
9. Confirmar que el requerimiento demo aparece en matriz y dashboard.

## Importacion Excel

1. En detalle de proyecto, importar un Excel en modo `append`.
2. Confirmar que se agregan requisitos nuevos sin duplicar existentes.
3. Repetir importacion en modo `replace` solo sobre un proyecto demo.
4. Confirmar que el listado se sustituye correctamente.
5. Exportar matriz a Excel y revisar columnas:
   - `Norma`
   - `Item`
   - `Requerimiento`
   - `Estado`
   - `Evidencia`
   - `Fecha limite`
   - `Analitica`

## Dashboard

1. Abrir `Dashboard`.
2. Probar filtros por:
   - norma
   - estado
   - proyecto
   - fecha
3. Confirmar que los KPIs cambian con los filtros.
4. Exportar CSV.
5. Exportar PDF.
6. Activar/desactivar preferencias de notificacion.
7. Enviar informe manual a un email controlado.
8. Confirmar recepcion del email y contenido:
   - cumplimiento
   - requerimientos
   - vencidos
   - proximos

## Alertas de vencimiento

1. Crear en proyecto demo:
   - un requerimiento vencido `No conforme`
   - un requerimiento proximo `Parcial`
   - un requerimiento vencido `Total`
2. Ejecutar diagnostico:

```powershell
Invoke-RestMethod `
  -Uri "https://APP_URL/api/cron/alerts?dryRun=1" `
  -Headers @{ Authorization = "Bearer CRON_SECRET" }
```

3. Confirmar que solo cuentan los estados `No conforme` y `Parcial`.
4. Ejecutar envio real solo si el diagnostico es correcto.
5. Repetir el cron el mismo dia y confirmar que no duplica alertas.

## Responsive

Validar al menos:

- escritorio ancho
- tablet
- movil estrecho

Pantallas minimas:

- login
- home
- proyectos
- detalle de proyecto
- matriz
- dashboard
- admin
- perfil

## Limpieza final

1. Borrar proyecto demo.
2. Borrar usuarios demo si no se necesitan.
3. Restaurar preferencias de notificacion del usuario usado.
4. Confirmar que no quedan proyectos con prefijo `DEMO` o `TEST`.
5. Confirmar `git status --short` limpio si hubo cambios de documentacion o codigo.

## Resultado esperado

- No hay errores visibles en UI.
- Las acciones destructivas requieren confirmacion.
- Los exports abren correctamente.
- Los emails llegan al destinatario controlado.
- Las alertas no incluyen requerimientos `Total`.
- La app queda sin datos temporales al terminar.
