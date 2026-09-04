// Genera el libro de trabajo para escribir los criterios de aceptacion.
//
// No inventa contenido: copia norma, item, titulo y descripcion de los Excel de
// docs/fuentes/ y deja cuatro columnas vacias para que las rellene el experto.
// El criterio es contenido normativo y no puede salir de un modelo (ADR-013).
//
// Reutiliza el parser real del importador para que las filas del libro sean
// exactamente las plantillas que se importaran: arrastra norma/item entre filas,
// descarta separadores y deduplica igual que la aplicacion.
//
// Uso: node scripts/preparar-excel-criterios.mjs
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { parseRoleTemplateRequirementWorkbook } from "../app/lib/requirementImport.ts";

const ORIGEN = "docs/fuentes";
const DESTINO = join(ORIGEN, "trabajo");

// Los cuatro apartados de ADR-013 D3, en su orden.
const APARTADOS = [
  "1. Que documento lo satisface",
  "2. Que debe encontrarse dentro",
  "3. Que NO basta",
  "4. Frontera entre NC mayor y NC menor",
];

// Recuento verificado contra produccion el 11-ago. Una desviacion significa que
// el parseo se ha comido filas: hay que parar, no publicar el libro.
const LIBROS = [
  { nombre: "requerimientos_adjudicador.xlsx", esperado: 38 },
  { nombre: "requerimientos_adjudicatario principal.xlsx", esperado: 35 },
  { nombre: "requerimientos_adjudicatario.xlsx", esperado: 18 },
];

await mkdir(DESTINO, { recursive: true });

let desviaciones = 0;

for (const { nombre, esperado } of LIBROS) {
  const buffer = await readFile(join(ORIGEN, nombre));
  const resultado = await parseRoleTemplateRequirementWorkbook(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  );

  if (resultado.errors.length > 0) {
    console.error(`${nombre}: el parser devuelve errores`);
    for (const error of resultado.errors) console.error(`  - ${error}`);
    process.exitCode = 1;
    continue;
  }

  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Criterios");

  hoja.columns = [
    { header: "Norma", key: "norma", width: 12 },
    { header: "Item", key: "item", width: 10 },
    { header: "Título del Requerimiento", key: "titulo", width: 40 },
    { header: "Descripción del Requerimiento", key: "descripcion", width: 60 },
    ...APARTADOS.map((header) => ({ header, width: 45 })),
  ];

  hoja.getRow(1).font = { bold: true };
  hoja.getRow(1).alignment = { vertical: "middle", wrapText: true };
  hoja.views = [{ state: "frozen", ySplit: 1 }];

  for (const fila of resultado.rows) {
    const añadida = hoja.addRow([
      fila.norma,
      fila.item,
      fila.titulo,
      fila.descripcion,
      "",
      "",
      "",
      "",
    ]);
    añadida.alignment = { vertical: "top", wrapText: true };
  }

  await writeFile(join(DESTINO, nombre), await libro.xlsx.writeBuffer());

  const marca = resultado.rows.length === esperado ? "" : `  <-- ESPERADOS ${esperado}`;
  if (resultado.rows.length !== esperado) desviaciones += 1;
  console.log(`${nombre}: ${resultado.rows.length} requisitos${marca}`);
}

if (desviaciones > 0) {
  console.error(`\nPARAR: ${desviaciones} libro(s) con un recuento distinto del verificado.`);
  process.exitCode = 1;
}
