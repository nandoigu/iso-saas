import { prisma } from "@/app/lib/prisma";
import { hashPassword } from "@/app/lib/auth";

/**
 * Sufijo unico para fixtures. `Date.now()` a secas colisiona entre dos registros
 * creados en el mismo milisegundo, que es lo normal dentro de un mismo test.
 */
let fixtureCounter = 0;
function uid() {
  fixtureCounter += 1;
  return `${Date.now()}-${fixtureCounter}`;
}

// ─── Tenant setup ────────────────────────────────────────────────────────────

export async function createTenant(suffix: string) {
  const company = await prisma.company.create({
    data: { name: `Test Company ${suffix}` },
  });
  const admin = await prisma.user.create({
    data: {
      email: `admin-${suffix}@test.local`,
      name: `Admin ${suffix}`,
      password: await hashPassword("test-password"),
      role: "admin",
      companyId: company.id,
    },
  });
  const user = await prisma.user.create({
    data: {
      email: `user-${suffix}@test.local`,
      name: `User ${suffix}`,
      password: await hashPassword("test-password"),
      role: "user",
      companyId: company.id,
    },
  });
  return { company, admin, user };
}

export async function createProject(companyId: string, userId: string) {
  return prisma.project.create({
    data: {
      name: "Test Project",
      role: "adjudicatario",
      userId,
      companyId,
    },
  });
}

// ─── Audit Team fixtures ──────────────────────────────────────────────────────

export async function createAuditor(
  companyId: string,
  createdById: string,
  overrides: { status?: string; email?: string } = {}
) {
  return prisma.auditor.create({
    data: {
      companyId,
      name: "Test Auditor",
      email: overrides.email ?? `auditor-${uid()}@test.local`,
      isExternal: false,
      status: overrides.status ?? "active",
      createdById,
    },
  });
}

export async function createAuditTeam(
  companyId: string,
  projectId: string,
  createdById: string
) {
  return prisma.auditTeam.create({
    data: {
      companyId,
      projectId,
      auditId: `AUDIT-${uid()}`,
      createdById,
    },
  });
}

export async function createMember(
  auditTeamId: string,
  auditorId: string,
  role: string,
  createdById: string,
  status = "invited"
) {
  return prisma.auditTeamMember.create({
    data: { auditTeamId, auditorId, role, status, createdById },
  });
}

export async function createAuditReport(
  projectId: string,
  auditTeamId: string,
  createdById: string,
  status: string
) {
  return prisma.auditReport.create({
    data: {
      auditId: `AUDIT-${uid()}`,
      reportNumber: `RPT-${uid()}`,
      version: 1,
      status,
      auditType: "inicial",
      scope: "Test scope",
      auditedOrgName: "Test Org",
      leadAuditor: "Test Lead",
      auditors: [],
      technicalExperts: [],
      auditStartDate: new Date(),
      auditEndDate: new Date(),
      reportDate: new Date(),
      applicableStandards: [],
      sourceData: {},
      generatedContent: {},
      traceability: {},
      complianceScore: 80,
      maturityScore: 3,
      riskScore: 2,
      confidenceScore: 90,
      globalStatus: "conforme",
      finalOpinion: "Test opinion",
      projectId,
      auditTeamId,
      createdById,
    },
  });
}

export async function createSignedReport(
  projectId: string,
  auditTeamId: string,
  createdById: string
) {
  return createAuditReport(projectId, auditTeamId, createdById, "signed");
}

// ─── Evidence Graph fixtures ─────────────────────────────────────────────────

export async function createRequirement(projectId: string, name = "Test Requirement") {
  return prisma.requirement.create({
    data: { projectId, name, status: "pendiente" },
  });
}

export async function createEvidenceItem(
  projectId: string,
  createdById: string,
  overrides: { title?: string; type?: string; status?: string; sourceRef?: string } = {}
) {
  return prisma.evidenceItem.create({
    data: {
      projectId,
      title: overrides.title ?? "Test Evidence",
      type: overrides.type ?? "document",
      status: overrides.status ?? "draft",
      sourceRef: overrides.sourceRef ?? null,
      createdBy: createdById,
    },
  });
}

export async function createRequirementLink(
  evidenceItemId: string,
  requirementId: string,
  addedById: string,
  linkType = "supporting"
) {
  return prisma.evidenceRequirementLink.create({
    data: { evidenceItemId, requirementId, linkType, addedBy: addedById },
  });
}

/**
 * Crea la validacion y aplica la transicion de estado que le corresponde, para que
 * la fixture deje la evidencia en un estado coherente con la invariante #1.
 */
export async function createEvidenceValidation(
  evidenceItemId: string,
  validatedById: string,
  outcome: string
) {
  const nextStatus =
    outcome === "approved" ? "validated" : outcome === "rejected" ? "rejected" : "under_review";

  const validation = await prisma.evidenceValidation.create({
    data: { evidenceItemId, outcome, notes: "", validatedBy: validatedById },
  });
  await prisma.evidenceItem.update({
    where: { id: evidenceItemId },
    data: { status: nextStatus },
  });
  return validation;
}

export async function createReportLink(
  evidenceItemId: string,
  auditReportId: string,
  addedById: string,
  usedAs = "supporting"
) {
  return prisma.evidenceReportLink.create({
    data: { evidenceItemId, auditReportId, usedAs, addedBy: addedById },
  });
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

export async function cleanupTenant(companyId: string) {
  // Delete in dependency order.
  // EvidenceItem va primero: su relacion con Project es `onDelete: Restrict`, asi que
  // dejarla viva bloquearia el borrado del proyecto. Links, validaciones y versiones
  // caen en cascada desde EvidenceItem.
  await prisma.evidenceItem.deleteMany({ where: { project: { companyId } } });
  await prisma.auditTeamMember.deleteMany({
    where: { auditTeam: { companyId } },
  });
  await prisma.auditReport.deleteMany({ where: { project: { companyId } } });
  await prisma.auditTeam.deleteMany({ where: { companyId } });
  await prisma.auditor.deleteMany({ where: { companyId } });
  await prisma.requirement.deleteMany({ where: { project: { companyId } } });
  await prisma.project.deleteMany({ where: { companyId } });
  await prisma.passwordResetToken.deleteMany({ where: { user: { companyId } } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.company.delete({ where: { id: companyId } });
}
