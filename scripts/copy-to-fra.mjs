/**
 * Copia selectiva de Londres a Frankfurt: solo el catalogo global de plantillas y
 * los usuarios reales con sus empresas. Deliberadamente NO copia proyectos,
 * requisitos, informes ni el residuo de pruebas del 10-may-2026.
 *
 * Los identificadores se conservan tal cual: si algun dia hay que cruzar datos con
 * un volcado antiguo, los ids siguen coincidiendo.
 *
 * Las credenciales van por variable de proceso, nunca por argumento ni fichero:
 *
 *   $env:SOURCE_DATABASE_URL = (npx neonctl connection-string production --project-id <londres> ...)
 *   $env:TARGET_DATABASE_URL = (npx neonctl connection-string production --project-id <frankfurt> ...)
 *   node scripts/copy-to-fra.mjs           # dry-run
 *   node scripts/copy-to-fra.mjs --apply   # escribe
 *
 * Idempotente: usa skipDuplicates, asi que relanzarlo no duplica nada.
 */
import { PrismaClient } from "@prisma/client";

const REAL_USER_EMAILS = [
  "figual@eficax.com",
  "fernando.igual@gmail.com",
  "info@eficax.com",
];

const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL;
if (!sourceUrl || !targetUrl) {
  console.error("Faltan SOURCE_DATABASE_URL y/o TARGET_DATABASE_URL.");
  process.exit(1);
}

const host = (u) => u.match(/@([^/]+)\//)?.[1] ?? "desconocido";
if (host(sourceUrl) === host(targetUrl)) {
  console.error("ABORTADO: origen y destino son el mismo host.");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");

console.log(`Origen:  ${host(sourceUrl)}`);
console.log(`Destino: ${host(targetUrl)}`);
console.log(APPLY ? "Modo: ESCRITURA\n" : "Modo: dry-run\n");

const source = new PrismaClient({ datasourceUrl: sourceUrl });
const target = new PrismaClient({ datasourceUrl: targetUrl });

// ─── Leer del origen ─────────────────────────────────────────────────────────

const templates = await source.requirementTemplate.findMany();
const users = await source.user.findMany({
  where: { email: { in: REAL_USER_EMAILS } },
});
const companyIds = [...new Set(users.map((u) => u.companyId).filter(Boolean))];
const companies = await source.company.findMany({
  where: { id: { in: companyIds } },
});

console.log("A copiar");
console.log(`  RequirementTemplate  ${templates.length}`);
console.log(`  Company              ${companies.length}`);
console.log(`  User                 ${users.length}`);
for (const u of users) {
  console.log(`    ${u.email} (${u.role})`);
}

const missing = REAL_USER_EMAILS.filter(
  (e) => !users.some((u) => u.email === e)
);
if (missing.length > 0) {
  console.log(`\n  ⚠️  No encontrados en origen: ${missing.join(", ")}`);
}

if (!APPLY) {
  console.log("\nDry-run. Relanza con --apply para escribir.");
  await source.$disconnect();
  await target.$disconnect();
  process.exit(0);
}

// ─── Escribir en destino ─────────────────────────────────────────────────────
// Orden por dependencia: Company antes que User (User.companyId apunta a Company).

const c = await target.company.createMany({ data: companies, skipDuplicates: true });
const u = await target.user.createMany({ data: users, skipDuplicates: true });
const t = await target.requirementTemplate.createMany({
  data: templates,
  skipDuplicates: true,
});

console.log("\nInsertado");
console.log(`  Company              ${c.count}`);
console.log(`  User                 ${u.count}`);
console.log(`  RequirementTemplate  ${t.count}`);

// ─── Verificar contra el destino, no contra lo que creemos haber escrito ─────

const verify = {
  Company: await target.company.count(),
  User: await target.user.count(),
  RequirementTemplate: await target.requirementTemplate.count(),
  Project: await target.project.count(),
  Requirement: await target.requirement.count(),
  AuditReport: await target.auditReport.count(),
  EvidenceItem: await target.evidenceItem.count(),
};
console.log("\nEstado final del destino");
for (const [table, n] of Object.entries(verify)) {
  console.log(`  ${table.padEnd(22)} ${n}`);
}

await source.$disconnect();
await target.$disconnect();
