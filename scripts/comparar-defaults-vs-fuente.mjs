/**
 * Compara app/lib/defaultRequirementTemplates.ts con los Excel de docs/fuentes.
 * Solo lectura. Sirve para saber si el fichero de semillas del codigo esta
 * alineado con la fuente autorizada.
 *
 *   node scripts/comparar-defaults-vs-fuente.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

const norm = (s) => (s ?? "").replace(/\s+/g, " ").trim();
const cmp = (s) => norm(s).toLowerCase();

const ts = readFileSync("app/lib/defaultRequirementTemplates.ts", "utf8");
const json = ts.slice(ts.indexOf("["), ts.indexOf("] satisfies") + 1);
const defaults = JSON.parse(json);
console.log(`defaultRequirementTemplates.ts: ${defaults.length} entradas`);

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

function roleFromFileName(name) {
  const n = name.toLowerCase();
  if (n.includes("principal")) return "adjudicatario_principal";
  if (n.includes("adjudicador")) return "adjudicador";
  if (n.includes("adjudicatario")) return "adjudicatario";
  throw new Error(`No se deduce el rol de ${name}`);
}

const fuente = [];
for (const file of readdirSync("docs/fuentes").filter((f) => f.endsWith(".xlsx"))) {
  const role = roleFromFileName(file);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join("docs/fuentes", file));
  const ws = wb.worksheets.find((s) => s.rowCount > 0);
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    const vals = [];
    row.eachCell({ includeEmpty: true }, (c, col) => (vals[col - 1] = cell(c)));
    const [norma, item, titulo, descripcion] = [0, 1, 2, 3].map((i) => norm(vals[i] ?? ""));
    if (!norma && !item && !titulo && !descripcion) return;
    fuente.push({ role, norma, item, titulo, descripcion });
  });
}
console.log(`docs/fuentes:                   ${fuente.length} filas\n`);

const k = (r) => `${r.role}|${r.norma}|${r.item}|${cmp(r.titulo)}`;
const mapTs = new Map(defaults.map((r) => [k(r), r]));
const mapFu = new Map(fuente.map((r) => [k(r), r]));

const soloTs = [...mapTs.keys()].filter((x) => !mapFu.has(x));
const soloFu = [...mapFu.keys()].filter((x) => !mapTs.has(x));
console.log(`Solo en el fichero TS (sobran): ${soloTs.length}`);
for (const x of soloTs) console.log(`  ${x.slice(0, 110)}`);
console.log(`Solo en la fuente (faltan):     ${soloFu.length}`);
for (const x of soloFu) console.log(`  ${x.slice(0, 110)}`);

const difs = [];
for (const [key, f] of mapFu) {
  const t = mapTs.get(key);
  if (t && cmp(t.descripcion) !== cmp(f.descripcion)) difs.push({ key, ts: norm(t.descripcion), fu: norm(f.descripcion) });
}
console.log(`\nDescripcion distinta: ${difs.length}`);
for (const d of difs) {
  console.log(`  ${d.key.slice(0, 110)}`);
  console.log(`    TS    : ${d.ts.slice(0, 160)}`);
  console.log(`    fuente: ${d.fu.slice(0, 160)}`);
}
