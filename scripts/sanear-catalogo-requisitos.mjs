/**
 * Saneado del catalogo RequirementTemplate contra la fuente autorizada de
 * docs/fuentes (11-ago-2026).
 *
 *   1. Borra las 85 plantillas con rol 'general' (rol inexistente en el codigo,
 *      sin descripcion, con duplicados internos y ausentes de la fuente).
 *   2. Borra la fila sobrante adjudicatario | 19650-2 | 5.7.2.
 *   3. Corrige la descripcion de adjudicador | 19650-2 | 5.2.2.
 *
 * Deja el catalogo en 91 plantillas identicas a los tres Excel de la fuente.
 *
 * Sin --apply solo inspecciona. Escribe unicamente con --apply.
 *
 *   node scripts/sanear-catalogo-requisitos.mjs [ruta-al-env] [--apply]
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const DESC_5_2_2 =
  "¿Reune la información de referencia o los recursos compartidos que tiene la intención de proporcionar al adjudicatario principal durante el proceso de petición de ofertas o adjudicación?";

const apply = process.argv.includes("--apply");
const envPath = process.argv.find((a) => a.startsWith(".env")) ?? ".env.test";

function urlFromEnvFile(p) {
  const raw = readFileSync(p, "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.trim().startsWith("DATABASE_URL="));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : null;
}

const url = process.env.SANEAR_DATABASE_URL ?? urlFromEnvFile(envPath);
if (!url) {
  console.error("No hay cadena de conexion.");
  process.exit(1);
}

// Guarda de jurisdiccion: ADR-007 exige que toda base de BAOS este en Frankfurt.
// Si la cadena apunta fuera de eu-central-1, no se escribe.
if (apply && !url.includes("eu-central-1")) {
  console.error("ABORTADO: la cadena de conexion no apunta a eu-central-1 (Frankfurt).");
  process.exit(1);
}

const prisma = new PrismaClient({ datasourceUrl: url });
console.log(`Host: ${url.match(/@([^/]+)\//)?.[1] ?? "desconocido"}`);
console.log(`Modo: ${apply ? "APLICAR (escribe)" : "inspeccion (no escribe)"}\n`);

const antes = await prisma.requirementTemplate.count();
const generales = await prisma.requirementTemplate.count({ where: { role: "general" } });
const sobrante = await prisma.requirementTemplate.findMany({
  where: { role: "adjudicatario", norma: "19650-2", item: "5.7.2" },
});
const objetivo = await prisma.requirementTemplate.findMany({
  where: { role: "adjudicador", norma: "19650-2", item: "5.2.2" },
});

console.log(`Plantillas ahora:                 ${antes}`);
console.log(`  rol 'general' a borrar:         ${generales}`);
console.log(`  adjudicatario 19650-2 5.7.2:    ${sobrante.length}`);
console.log(`  adjudicador 19650-2 5.2.2:      ${objetivo.length}`);

// Requisitos ya generados que apuntan a lo que se va a borrar. onDelete: SetNull,
// asi que no se pierden: se quedan sin vinculo a plantilla.
const idsABorrar = [
  ...(await prisma.requirementTemplate.findMany({ where: { role: "general" }, select: { id: true } })).map((r) => r.id),
  ...sobrante.map((r) => r.id),
];
const requisitosAfectados = await prisma.requirement.count({ where: { templateId: { in: idsABorrar } } });
console.log(`\nRequisitos de proyectos que quedarian sin vinculo (templateId -> null): ${requisitosAfectados}`);

if (generales !== 85 || sobrante.length !== 1 || objetivo.length !== 1) {
  console.log("\n⚠ El estado no coincide con lo revisado el 11-ago. Revisar antes de aplicar.");
}

if (!apply) {
  console.log("\nNada escrito. Repetir con --apply para ejecutar.");
  await prisma.$disconnect();
  process.exit(0);
}

const resultado = await prisma.$transaction(async (tx) => {
  const borradasGeneral = await tx.requirementTemplate.deleteMany({ where: { role: "general" } });
  const borradaSobrante = await tx.requirementTemplate.deleteMany({
    where: { role: "adjudicatario", norma: "19650-2", item: "5.7.2" },
  });
  const corregida = await tx.requirementTemplate.updateMany({
    where: { role: "adjudicador", norma: "19650-2", item: "5.2.2" },
    data: { descripcion: DESC_5_2_2 },
  });
  return { borradasGeneral: borradasGeneral.count, borradaSobrante: borradaSobrante.count, corregida: corregida.count };
});

const despues = await prisma.requirementTemplate.count();
console.log(`\nBorradas rol 'general':   ${resultado.borradasGeneral}`);
console.log(`Borrada 5.7.2:            ${resultado.borradaSobrante}`);
console.log(`Corregida 5.2.2:          ${resultado.corregida}`);
console.log(`\nPlantillas antes: ${antes}   despues: ${despues}`);

const porRol = await prisma.requirementTemplate.groupBy({ by: ["role"], _count: { _all: true } });
console.log("\nPor rol");
for (const r of porRol.sort((a, b) => a.role.localeCompare(b.role))) {
  console.log(`  ${r.role.padEnd(26)} ${r._count._all}`);
}

const check = await prisma.requirementTemplate.findFirst({
  where: { role: "adjudicador", norma: "19650-2", item: "5.2.2" },
  select: { descripcion: true },
});
console.log(`\n5.2.2 en la base: ${check?.descripcion}`);

await prisma.$disconnect();
