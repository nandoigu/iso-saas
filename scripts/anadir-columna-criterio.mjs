/**
 * Anade la columna "Criterio de Aceptacion" a los Excel de docs/fuentes.
 * Solo escribe la cabecera; las filas quedan vacias para que las rellene el
 * experto. No toca ninguna de las cuatro columnas existentes.
 *
 * Hace copia de seguridad de cada fichero antes de tocarlo.
 *
 *   node scripts/anadir-columna-criterio.mjs           # inspeccion
 *   node scripts/anadir-columna-criterio.mjs --apply
 */
import { readdirSync, copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

const DIR = "docs/fuentes";
const CABECERA = "Criterio de Aceptación";
const apply = process.argv.includes("--apply");

const cell = (c) => {
  const v = c?.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
    if (v.text) return String(v.text);
    if (v.result !== undefined) return String(v.result);
    return "";
  }
  return String(v);
};

console.log(`Modo: ${apply ? "APLICAR (escribe)" : "inspeccion (no escribe)"}\n`);

for (const file of readdirSync(DIR).filter((f) => f.endsWith(".xlsx"))) {
  const ruta = path.join(DIR, file);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ruta);
  const ws = wb.worksheets.find((s) => s.rowCount > 0);

  const cabeceras = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (c, col) => (cabeceras[col - 1] = cell(c)));
  const yaEsta = cabeceras.some((h) => h.trim().toLowerCase() === CABECERA.toLowerCase());

  console.log(`${file}`);
  console.log(`  hoja "${ws.name}", ${ws.rowCount - 1} requisitos`);
  console.log(`  cabeceras: ${cabeceras.filter(Boolean).join(" | ")}`);

  if (yaEsta) {
    console.log(`  -> ya tiene la columna, no se toca\n`);
    continue;
  }

  const destino = cabeceras.length + 1;
  console.log(`  -> se anadira "${CABECERA}" en la columna ${destino}\n`);

  if (!apply) continue;

  const backup = `${ruta}.bak`;
  if (!existsSync(backup)) copyFileSync(ruta, backup);

  const celda = ws.getRow(1).getCell(destino);
  celda.value = CABECERA;
  // Se copia el estilo de la cabecera anterior para que no desentone.
  const previa = ws.getRow(1).getCell(destino - 1);
  celda.style = { ...previa.style };
  ws.getColumn(destino).width = 60;

  await wb.xlsx.writeFile(ruta);
  console.log(`  escrito. Copia de seguridad en ${path.basename(backup)}\n`);
}

if (!apply) console.log("Nada escrito. Repetir con --apply.");
