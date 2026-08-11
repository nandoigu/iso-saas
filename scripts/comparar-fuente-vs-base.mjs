/**
 * Compara los Excel de docs/fuentes (fuente autorizada del usuario) con las
 * RequirementTemplate que hay en la base. Solo lectura: no escribe nada.
 *
 *   node scripts/comparar-fuente-vs-base.mjs [ruta-al-env]
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";

const dir = "docs/fuentes";

function urlFromEnvFile(p) {
  const raw = readFileSync(p, "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.trim().startsWith("DATABASE_URL="));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : null;
}

const envPath = process.argv[2] ?? ".env.test";
const url = process.env.DUMP_DATABASE_URL ?? urlFromEnvFile(envPath);
if (!url) {
  console.error("No hay cadena de conexion.");
  process.exit(1);
}

const norm = (s) => (s ?? "").replace(/\s+/g, " ").trim();
const cmp = (s) => norm(s).toLowerCase();

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

// --- fuente ---------------------------------------------------------------
const fuente = new Map(); // role -> filas
for (const file of readdirSync(dir).filter((f) => f.endsWith(".xlsx"))) {
  const role = roleFromFileName(file);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(dir, file));
  const ws = wb.worksheets.find((s) => s.rowCount > 0);
  const filas = [];
  let normaActual = "";
  let itemActual = "";
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return; // cabecera
    const vals = [];
    row.eachCell({ includeEmpty: true }, (c, col) => (vals[col - 1] = cell(c)));
    const [norma, item, titulo, descripcion] = [0, 1, 2, 3].map((i) => norm(vals[i] ?? ""));
    if (!norma && !item && !titulo && !descripcion) return;
    normaActual = norma || normaActual;
    itemActual = item || itemActual;
    filas.push({ fila: n, norma: normaActual, item: itemActual, titulo, descripcion });
  });
  fuente.set(role, filas);
  console.log(`${file}  ->  ${role}: ${filas.length} filas (hoja "${ws.name}")`);
}

// --- base -----------------------------------------------------------------
const prisma = new PrismaClient({ datasourceUrl: url });
console.log(`\nBase: ${url.match(/@([^/]+)\//)?.[1] ?? "desconocido"}\n`);
const dbRows = await prisma.requirementTemplate.findMany();

const clave = (r) => `${norm(r.norma)}|${norm(r.item)}`;

for (const [role, filas] of [...fuente].sort()) {
  const enBase = dbRows.filter((r) => r.role === role);
  console.log(`\n${"=".repeat(78)}\n${role.toUpperCase()}  —  fuente: ${filas.length}   base: ${enBase.length}\n`);

  const mapFuente = new Map();
  for (const f of filas) {
    const k = clave(f);
    if (!mapFuente.has(k)) mapFuente.set(k, []);
    mapFuente.get(k).push(f);
  }
  const mapBase = new Map();
  for (const b of enBase) {
    const k = clave(b);
    if (!mapBase.has(k)) mapBase.set(k, []);
    mapBase.get(k).push(b);
  }

  const faltan = [...mapFuente.keys()].filter((k) => !mapBase.has(k));
  const sobran = [...mapBase.keys()].filter((k) => !mapFuente.has(k));

  console.log(`FALTAN EN LA BASE (${faltan.length})`);
  for (const k of faltan) for (const f of mapFuente.get(k)) console.log(`  ${k}  ${f.titulo}`);

  console.log(`\nSOBRAN EN LA BASE, no estan en tu fuente (${sobran.length})`);
  for (const k of sobran) for (const b of mapBase.get(k)) console.log(`  ${k}  ${norm(b.titulo)}`);

  const dupF = [...mapFuente].filter(([, v]) => v.length > 1);
  const dupB = [...mapBase].filter(([, v]) => v.length > 1);
  if (dupF.length) console.log(`\nApartados repetidos en tu fuente: ${dupF.map(([k, v]) => `${k} x${v.length}`).join(", ")}`);
  if (dupB.length) console.log(`Apartados repetidos en la base:   ${dupB.map(([k, v]) => `${k} x${v.length}`).join(", ")}`);

  const difTitulo = [];
  const difDesc = [];
  for (const [k, fs] of mapFuente) {
    const bs = mapBase.get(k);
    if (!bs || fs.length !== 1 || bs.length !== 1) continue;
    const f = fs[0];
    const b = bs[0];
    if (cmp(f.titulo) !== cmp(b.titulo)) difTitulo.push({ k, f: norm(f.titulo), b: norm(b.titulo) });
    if (cmp(f.descripcion) !== cmp(b.descripcion)) difDesc.push({ k, f: norm(f.descripcion), b: norm(b.descripcion) });
  }

  console.log(`\nTITULO DISTINTO (${difTitulo.length})`);
  for (const d of difTitulo) {
    console.log(`  ${d.k}`);
    console.log(`    fuente: ${d.f}`);
    console.log(`    base  : ${d.b}`);
  }

  console.log(`\nDESCRIPCION DISTINTA (${difDesc.length})`);
  for (const d of difDesc) {
    console.log(`  ${d.k}`);
    console.log(`    fuente: ${d.f}`);
    console.log(`    base  : ${d.b}`);
  }

  const iguales = [...mapFuente].filter(([k, fs]) => {
    const bs = mapBase.get(k);
    return bs && fs.length === 1 && bs.length === 1 && cmp(fs[0].titulo) === cmp(bs[0].titulo) && cmp(fs[0].descripcion) === cmp(bs[0].descripcion);
  }).length;
  console.log(`\nIDENTICOS: ${iguales}`);
}

await prisma.$disconnect();
