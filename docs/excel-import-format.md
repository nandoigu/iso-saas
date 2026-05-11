# Formato de importación Excel

La app acepta archivos `.xlsx`. La primera hoja del libro debe contener la cabecera en la primera fila.

## Plantilla global de requisitos

Se usa desde la pantalla de proyectos para definir la plantilla base que se reutiliza al crear nuevos proyectos.

Columnas requeridas:

- `norma`
- `item`
- `titulo`
- `descripcion`

Columna opcional:

- `fase`

Si se activa la opción de reemplazo, la plantilla actual se vacía antes de importar las filas válidas del archivo.

## Requisitos de un proyecto

Se usa dentro del detalle de un proyecto para añadir o reemplazar requisitos de ese proyecto concreto.

Columnas requeridas:

- `norma`
- `item`
- `requerimiento`
- `evidencia`
- `estado`
- `fecha_limite`

Alias aceptados:

- `descripcion` o `descripción` para el texto del requerimiento.
- `fecha`, `fecha_limite` o `fecha límite` para la fecha límite.
- `cumplimiento` para el estado.

Valores de estado aceptados:

- `total`
- `parcial`
- `no_conforme`

Fechas aceptadas:

- Fecha nativa de Excel.
- Texto con formato `YYYY-MM-DD`.

## Modos de importación

- `Añadir solo nuevos`: conserva los requisitos actuales y omite duplicados.
- `Reemplazar requerimientos del proyecto`: elimina primero los requisitos actuales del proyecto y después importa las filas válidas del Excel.

## Errores habituales

- Cabeceras no reconocidas: revisa que la primera fila contenga los nombres esperados.
- Fecha no válida: usa fecha real de Excel o `YYYY-MM-DD`.
- Estado no válido: usa `total`, `parcial` o `no_conforme`.
- Filas duplicadas: se detectan por combinación de norma, item y requerimiento.
- Archivo demasiado grande: reduce filas, columnas o textos excesivamente largos.
