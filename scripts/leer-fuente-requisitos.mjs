/**
 * Lectura de solo lectura de los Excel de docs/fuentes.
 * Primero inspecciona la estructura (hojas, cabeceras, filas) para no dar nada por
 * supuesto sobre el formato. No toca la base de datos.
 *
 *   node scripts/leer-fuente-requisitos.mjs           # inspeccion
 *   node scripts/leer-fuente-requisitos.mjs --volcado # filas completas
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

const dir = "docs/fuentes";
const volcado = process.argv.includes("--volcado");

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

for (const file of readdirSync(dir).filter((f) => f.endsWith(".xlsx"))) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(dir, file));
  console.log(`\n${"=".repeat(78)}\nFICHERO: ${file}`);
  wb.eachSheet((ws) => {
    console.log(`\n  Hoja "${ws.name}" — ${ws.rowCount} filas x ${ws.columnCount} columnas`);
    const filas = [];
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      const vals = [];
      row.eachCell({ includeEmpty: true }, (c, col) => (vals[col - 1] = cell(c)));
      filas.push({ n, vals: Array.from(vals, (v) => v ?? "") });
    });
    const limite = volcado ? filas.length : Math.min(filas.length, 6);
    for (const f of filas.slice(0, limite)) {
      const texto = f.vals
        .map((v) => (volcado ? v.replace(/\s*\n\s*/g, " ") : v.replace(/\s*\n\s*/g, " ").slice(0, 70)))
        .map((v, i) => `[${i}] ${v}`)
        .join(volcado ? "\n      " : " | ");
      console.log(`    fila ${String(f.n).padStart(3)}: ${texto}`);
    }
    if (!volcado && filas.length > limite) {
      console.log(`    ... ${filas.length - limite} filas mas`);
    }
  });
}
