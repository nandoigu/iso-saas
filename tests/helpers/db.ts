import { prisma } from "@/app/lib/prisma";
import { hashPassword } from "@/app/lib/auth";

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
      email: overrides.email ?? `auditor-${Date.now()}@test.local`,
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
      auditId: `AUDIT-${Date.now()}`,
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

export async function createSignedReport(
  projectId: string,
  auditTeamId: string,
  createdById: string
) {
  return prisma.auditReport.create({
    data: {
      auditId: `AUDIT-${Date.now()}`,
      reportNumber: `RPT-${Date.now()}`,
      version: 1,
      status: "signed",
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

// ─── Cleanup ─────────────────────────────────────────────────────────────────

export async function cleanupTenant(companyId: string) {
  // Delete in dependency order
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
