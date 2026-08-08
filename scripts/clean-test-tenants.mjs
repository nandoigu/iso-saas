/**
 * Limpia tenants de test huerfanos en la rama Test de Neon.
 *
 * Si un run de vitest se aborta a mitad, los `afterAll` no llegan a ejecutarse y las
 * companies quedan vivas. Como `createTenant` usa sufijos fijos, el siguiente run
 * falla con violacion de unicidad en el email. Este script deja la rama limpia.
 *
 *   node scripts/clean-test-tenants.mjs           # inspeccion
 *   node scripts/clean-test-tenants.mjs --apply   # borrado
 *
 * Guarda dura: se niega a ejecutar si DATABASE_URL no apunta a la rama de test.
 */
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ path: ".env.test", override: true });

const TEST_HOST = "ep-round-lab-abx9w83m-pooler.eu-west-2.aws.neon.tech";
const url = process.env.DATABASE_URL ?? "";
if (!url.includes(TEST_HOST)) {
  console.error(`ABORTADO: DATABASE_URL no apunta a la rama de test (${TEST_HOST}).`);
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

const companies = await prisma.company.findMany({
  where: { name: { startsWith: "Test Company " } },
  select: {
    id: true,
    name: true,
    _count: { select: { users: true, projects: true } },
  },
});

console.log(`Tenants de test encontrados: ${companies.length}`);
for (const c of companies) {
  console.log(`  ${c.name} — ${c._count.users} usuarios, ${c._count.projects} proyectos`);
}

if (!APPLY) {
  console.log("\nModo inspeccion. Relanza con --apply para borrar.");
  await prisma.$disconnect();
  process.exit(0);
}

for (const c of companies) {
  await prisma.evidenceItem.deleteMany({ where: { project: { companyId: c.id } } });
  await prisma.auditTeamMember.deleteMany({ where: { auditTeam: { companyId: c.id } } });
  await prisma.auditReport.deleteMany({ where: { project: { companyId: c.id } } });
  await prisma.auditTeam.deleteMany({ where: { companyId: c.id } });
  await prisma.auditor.deleteMany({ where: { companyId: c.id } });
  await prisma.requirement.deleteMany({ where: { project: { companyId: c.id } } });
  await prisma.project.deleteMany({ where: { companyId: c.id } });
  await prisma.passwordResetToken.deleteMany({ where: { user: { companyId: c.id } } });
  await prisma.user.deleteMany({ where: { companyId: c.id } });
  await prisma.company.delete({ where: { id: c.id } });
  console.log(`  borrado: ${c.name}`);
}

console.log(`\n${companies.length} tenants de test eliminados.`);
await prisma.$disconnect();
