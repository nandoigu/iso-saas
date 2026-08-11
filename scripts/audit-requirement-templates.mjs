/**
 * Diagnostico de solo lectura del catalogo RequirementTemplate.
 * Cuenta por rol/norma, duplicados, campos vacios y anomalias de forma.
 * No escribe nada.
 *
 *   node scripts/audit-requirement-templates.mjs [ruta-al-env]
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function urlFromEnvFile(path) {
  const raw = readFileSync(path, "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.trim().startsWith("DATABASE_URL="));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : null;
}

const envPath = process.argv[2] ?? ".env.test";
const url = process.env.DUMP_DATABASE_URL ?? urlFromEnvFile(envPath);
if (!url) {
  console.error("No hay cadena de conexion.");
  process.exit(1);
}
console.log(`Host: ${url.match(/@([^/]+)\//)?.[1] ?? "desconocido"}`);

const prisma = new PrismaClient({ datasourceUrl: url });
const rows = await prisma.requirementTemplate.findMany();
console.log(`Total plantillas: ${rows.length}\n`);

const groups = new Map();
for (const r of rows) {
  const k = `${r.role}/${r.norma}`;
  groups.set(k, (groups.get(k) ?? 0) + 1);
}
console.log("Por rol y norma");
for (const [k, n] of [...groups].sort()) console.log(`  ${k.padEnd(34)} ${n}`);

const roles = new Map();
for (const r of rows) roles.set(r.role, (roles.get(r.role) ?? 0) + 1);
console.log("\nPor rol (lo que recibe un proyecto de ese rol)");
for (const [k, n] of [...roles].sort()) console.log(`  ${k.padEnd(34)} ${n}`);

const sinDesc = rows.filter((r) => !r.descripcion || !r.descripcion.trim());
console.log(`\nSin descripcion: ${sinDesc.length}`);
const porRolSinDesc = new Map();
for (const r of sinDesc) porRolSinDesc.set(r.role, (porRolSinDesc.get(r.role) ?? 0) + 1);
for (const [k, n] of [...porRolSinDesc].sort()) console.log(`  ${k.padEnd(34)} ${n}`);

const tituloPregunta = rows.filter((r) => (r.titulo ?? "").trim().startsWith("¿"));
console.log(`\nTitulo que en realidad es la pregunta (empieza por '¿'): ${tituloPregunta.length}`);

const tituloLargo = rows.filter((r) => (r.titulo ?? "").length > 120);
console.log(`Titulo de mas de 120 caracteres: ${tituloLargo.length}`);

const dupItem = new Map();
for (const r of rows) {
  const k = `${r.role}|${r.norma}|${r.item}`;
  if (!dupItem.has(k)) dupItem.set(k, []);
  dupItem.get(k).push(r);
}
const repes = [...dupItem].filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length);
console.log(`\nClaves (rol|norma|item) con mas de una fila: ${repes.length}`);
for (const [k, v] of repes) console.log(`  ${k.padEnd(38)} ${v.length}`);

const sospechosos = ["[J", "calendacio", "establcido", "recoplidado", "especilamente", "adjudicatorio", "validad ", "contendores", "requerimentos", "diseñe técnico"];
console.log("\nErratas detectadas (texto tal cual en la base)");
for (const s of sospechosos) {
  const n = rows.filter((r) => `${r.titulo ?? ""} ${r.descripcion ?? ""}`.includes(s)).length;
  if (n > 0) console.log(`  ${JSON.stringify(s).padEnd(20)} ${n} fila(s)`);
}

// Mismo apartado de la misma norma repartido entre varios roles: no es un error en
// si (la norma reparte obligaciones), pero conviene ver si el texto coincide o ha
// derivado por copia manual.
const porItem = new Map();
for (const r of rows.filter((x) => x.role !== "general")) {
  const k = `${r.norma}|${r.item}`;
  if (!porItem.has(k)) porItem.set(k, []);
  porItem.get(k).push(r);
}
const compartidos = [...porItem].filter(([, v]) => v.length > 1);
let identicos = 0;
let divergentes = 0;
for (const [, v] of compartidos) {
  const norm = (s) => (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const set = new Set(v.map((r) => norm(r.descripcion)));
  if (set.size === 1) identicos += 1;
  else divergentes += 1;
}
console.log(`\nApartados presentes en mas de un rol (sin contar 'general'): ${compartidos.length}`);
console.log(`  con descripcion identica en todos:  ${identicos}`);
console.log(`  con descripcion distinta entre roles: ${divergentes}`);

const normas = new Map();
for (const r of rows) normas.set(r.norma, (normas.get(r.norma) ?? 0) + 1);
console.log("\nNormas presentes");
for (const [k, n] of [...normas].sort()) console.log(`  ${k.padEnd(34)} ${n}`);

await prisma.$disconnect();
