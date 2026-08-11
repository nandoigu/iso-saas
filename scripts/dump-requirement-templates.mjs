/**
 * Volcado de solo lectura del catalogo global de RequirementTemplate.
 * Sirve para revisar a mano los requisitos que la app carga en cada proyecto.
 *
 * La credencial se lee de DUMP_DATABASE_URL si existe; si no, del DATABASE_URL
 * del .env indicado (por defecto .env.test, que apunta a la rama Test).
 * No escribe nada en la base.
 *
 *   node scripts/dump-requirement-templates.mjs [ruta-al-env] > salida.md
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function urlFromEnvFile(path) {
  const raw = readFileSync(path, "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.trim().startsWith("DATABASE_URL="));
  if (!line) return null;
  return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
}

const envPath = process.argv[2] ?? ".env.test";
const url = process.env.DUMP_DATABASE_URL ?? urlFromEnvFile(envPath);
if (!url) {
  console.error("No hay cadena de conexion.");
  process.exit(1);
}

// Host visible para saber contra que base se mira, sin revelar usuario ni contrasena.
console.error(`Host: ${url.match(/@([^/]+)\//)?.[1] ?? "desconocido"}`);

const prisma = new PrismaClient({ datasourceUrl: url });

const rows = await prisma.requirementTemplate.findMany();

console.error(`Total: ${rows.length}`);

// Orden natural por apartado (5.1 antes que 10.1). La base y la app ordenan el
// campo `item` como texto, asi que alli 10.x sale antes que 5.x.
const itemKey = (item) => (item ?? "").split(".").map((p) => String(p).padStart(4, "0")).join(".");

const byRole = new Map();
for (const r of rows) {
  const key = `${r.role} | ${r.norma}`;
  if (!byRole.has(key)) byRole.set(key, []);
  byRole.get(key).push(r);
}

console.log("# Catalogo actual de RequirementTemplate\n");
console.log(`Volcado de solo lectura. Total: ${rows.length} plantillas.`);
console.log("Ordenado por apartado natural. Las filas marcadas SIN DESCRIPCION llevan");
console.log("la pregunta en el titulo y el campo descripcion vacio.\n");

for (const [key, list] of [...byRole].sort()) {
  console.log(`\n## ${key} — ${list.length} requisitos\n`);
  list.sort((a, b) => itemKey(a.item).localeCompare(itemKey(b.item)));
  let n = 0;
  for (const r of list) {
    const desc = (r.descripcion ?? "").replace(/\s*\n\s*/g, " ").trim();
    const titulo = (r.titulo ?? "").replace(/\s*\n\s*/g, " ").trim();
    n += 1;
    console.log(`${n}. **${r.item}** · ${titulo}`);
    console.log(desc ? `   - ${desc}` : `   - _SIN DESCRIPCION_`);
  }
}

await prisma.$disconnect();
