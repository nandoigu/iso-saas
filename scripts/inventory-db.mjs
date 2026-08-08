/**
 * Inventario de solo lectura de una base BAOS. Sirve para decidir y verificar
 * migraciones sin abrir la consola de Neon.
 *
 * La credencial NO se pasa por argumento ni se escribe en ningun fichero: se lee de
 * INVENTORY_DATABASE_URL, que se rellena en la misma linea de comando desde
 * `neonctl connection-string`. Asi no queda en .env ni en el historial.
 *
 *   $env:INVENTORY_DATABASE_URL = (npx neonctl connection-string ...)
 *   node scripts/inventory-db.mjs
 *
 * No escribe nada. Solo COUNT y unos pocos campos identificativos.
 */
import { PrismaClient } from "@prisma/client";

const url = process.env.INVENTORY_DATABASE_URL;
if (!url) {
  console.error("Falta INVENTORY_DATABASE_URL.");
  process.exit(1);
}

// Se muestra el host para saber siempre contra que base se esta mirando, sin revelar
// usuario ni contrasena.
console.log(`Host: ${url.match(/@([^/]+)\//)?.[1] ?? "desconocido"}\n`);

const prisma = new PrismaClient({ datasourceUrl: url });

const counts = {
  Company: await prisma.company.count(),
  User: await prisma.user.count(),
  Project: await prisma.project.count(),
  Requirement: await prisma.requirement.count(),
  RequirementTemplate: await prisma.requirementTemplate.count(),
  PasswordResetToken: await prisma.passwordResetToken.count(),
  AuditReport: await prisma.auditReport.count(),
  AuditReportVersion: await prisma.auditReportVersion.count(),
  Auditor: await prisma.auditor.count(),
  AuditTeam: await prisma.auditTeam.count(),
  AuditTeamMember: await prisma.auditTeamMember.count(),
  EvidenceItem: await prisma.evidenceItem.count(),
  EvidenceRequirementLink: await prisma.evidenceRequirementLink.count(),
  EvidenceReportLink: await prisma.evidenceReportLink.count(),
  EvidenceValidation: await prisma.evidenceValidation.count(),
  EvidenceItemVersion: await prisma.evidenceItemVersion.count(),
};

console.log("Filas por tabla");
for (const [table, n] of Object.entries(counts)) {
  console.log(`  ${table.padEnd(26)} ${n}`);
}

const users = await prisma.user.findMany({
  select: { email: true, role: true, status: true, createdAt: true },
  orderBy: { createdAt: "asc" },
});
console.log("\nUsuarios");
for (const u of users) {
  console.log(
    `  ${u.email.padEnd(34)} ${u.role.padEnd(6)} ${u.status.padEnd(9)} ${u.createdAt.toISOString().slice(0, 10)}`
  );
}

const projects = await prisma.project.findMany({
  select: {
    name: true,
    role: true,
    createdAt: true,
    _count: { select: { requirements: true } },
  },
  orderBy: { createdAt: "asc" },
});
console.log("\nProyectos");
for (const p of projects) {
  console.log(
    `  ${p.name.padEnd(34)} ${p.role.padEnd(24)} ${String(p._count.requirements).padStart(4)} req  ${p.createdAt.toISOString().slice(0, 10)}`
  );
}

const migrations = await prisma.$queryRaw`
  SELECT migration_name, finished_at
  FROM _prisma_migrations
  ORDER BY finished_at DESC
  LIMIT 3
`;
console.log(`\nUltimas migraciones aplicadas`);
for (const m of migrations) {
  console.log(`  ${m.migration_name}  ${m.finished_at?.toISOString().slice(0, 10) ?? "-"}`);
}

await prisma.$disconnect();
