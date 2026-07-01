import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createAuditor,
  addAuditTeamMember,
  updateAuditTeamMember,
  updateAuditor,
  createAuditTeam,
} from "@/services/audit-team.service";
import {
  createTenant,
  createProject,
  createAuditor as dbCreateAuditor,
  createAuditTeam as dbCreateAuditTeam,
  createMember,
  createSignedReport,
  cleanupTenant,
} from "@/tests/helpers/db";

let tenantA: Awaited<ReturnType<typeof createTenant>>;
let projectId: string;

beforeAll(async () => {
  tenantA = await createTenant("svc-audit-team");
  const project = await createProject(tenantA.company.id, tenantA.admin.id);
  projectId = project.id;
});

afterAll(async () => {
  await cleanupTenant(tenantA.company.id);
});

// ─── INV-01: lead_auditor único por equipo ────────────────────────────────────

describe("INV-01 — lead_auditor único por equipo", () => {
  it("permite asignar el primer lead_auditor", async () => {
    const team = await dbCreateAuditTeam(tenantA.company.id, projectId, tenantA.admin.id);
    const auditor = await dbCreateAuditor(tenantA.company.id, tenantA.admin.id);

    const result = await addAuditTeamMember({
      auditTeamId: team.id,
      auditorId: auditor.id,
      role: "lead_auditor",
      createdById: tenantA.admin.id,
    });

    expect("member" in result).toBe(true);
    if ("member" in result) expect(result.member.role).toBe("lead_auditor");
  });

  it("rechaza un segundo lead_auditor cuando ya existe uno activo", async () => {
    const team = await dbCreateAuditTeam(tenantA.company.id, projectId, tenantA.admin.id);
    const a1 = await dbCreateAuditor(tenantA.company.id, tenantA.admin.id);
    const a2 = await dbCreateAuditor(tenantA.company.id, tenantA.admin.id);

    await createMember(team.id, a1.id, "lead_auditor", tenantA.admin.id, "confirmed");

    const result = await addAuditTeamMember({
      auditTeamId: team.id,
      auditorId: a2.id,
      role: "lead_auditor",
      createdById: tenantA.admin.id,
    });

    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toMatch(/auditor líder activo/);
  });

  it("permite asignar lead_auditor cuando el anterior está withdrawn", async () => {
    const team = await dbCreateAuditTeam(tenantA.company.id, projectId, tenantA.admin.id);
    const a1 = await dbCreateAuditor(tenantA.company.id, tenantA.admin.id);
    const a2 = await dbCreateAuditor(tenantA.company.id, tenantA.admin.id);

    await createMember(team.id, a1.id, "lead_auditor", tenantA.admin.id, "withdrawn");

    const result = await addAuditTeamMember({
      auditTeamId: team.id,
      auditorId: a2.id,
      role: "lead_auditor",
      createdById: tenantA.admin.id,
    });

    expect("member" in result).toBe(true);
  });
});

// ─── INV-02: auditor único por equipo ────────────────────────────────────────

describe("INV-02 — auditor asignado una sola vez por equipo", () => {
  it("rechaza asignar el mismo auditor dos veces al mismo equipo", async () => {
    const team = await dbCreateAuditTeam(tenantA.company.id, projectId, tenantA.admin.id);
    const auditor = await dbCreateAuditor(tenantA.company.id, tenantA.admin.id);

    await createMember(team.id, auditor.id, "support_auditor", tenantA.admin.id);

    const result = await addAuditTeamMember({
      auditTeamId: team.id,
      auditorId: auditor.id,
      role: "technical_expert",
      createdById: tenantA.admin.id,
    });

    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toMatch(/ya está asignado/);
  });
});

// ─── INV-03: retirar lead sin sucesor ────────────────────────────────────────

describe("INV-03 — retirar lead_auditor requiere sucesor confirmado", () => {
  it("rechaza retirar el único lead_auditor sin sucesor", async () => {
    const team = await dbCreateAuditTeam(tenantA.company.id, projectId, tenantA.admin.id);
    const auditor = await dbCreateAuditor(tenantA.company.id, tenantA.admin.id);
    const member = await createMember(team.id, auditor.id, "lead_auditor", tenantA.admin.id, "confirmed");

    const result = await updateAuditTeamMember(
      member.id,
      team.id,
      tenantA.company.id,
      { status: "withdrawn" }
    );

    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toMatch(/sucesor confirmado/);
  });

  it("permite retirar lead_auditor cuando ya existe otro confirmado", async () => {
    const team = await dbCreateAuditTeam(tenantA.company.id, projectId, tenantA.admin.id);
    const a1 = await dbCreateAuditor(tenantA.company.id, tenantA.admin.id);
    const a2 = await dbCreateAuditor(tenantA.company.id, tenantA.admin.id);

    const lead1 = await createMember(team.id, a1.id, "lead_auditor", tenantA.admin.id, "confirmed");
    await createMember(team.id, a2.id, "lead_auditor", tenantA.admin.id, "confirmed");

    const result = await updateAuditTeamMember(
      lead1.id,
      team.id,
      tenantA.company.id,
      { status: "withdrawn" }
    );

    expect("member" in result).toBe(true);
    if ("member" in result) {
      expect(result.member.status).toBe("withdrawn");
      expect(result.member.withdrawnAt).not.toBeNull();
    }
  });
});

// ─── INV-04: auditor activo no suspendible ────────────────────────────────────

describe("INV-04 — auditor con asignaciones activas no puede suspenderse", () => {
  it("rechaza suspender un auditor con asignación en estado invited", async () => {
    const team = await dbCreateAuditTeam(tenantA.company.id, projectId, tenantA.admin.id);
    const auditor = await dbCreateAuditor(tenantA.company.id, tenantA.admin.id);
    await createMember(team.id, auditor.id, "support_auditor", tenantA.admin.id, "invited");

    const result = await updateAuditor(auditor.id, tenantA.company.id, { status: "suspended" });

    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toMatch(/asignaciones activas/);
  });

  it("permite suspender un auditor cuando todas sus asignaciones están completed", async () => {
    const team = await dbCreateAuditTeam(tenantA.company.id, projectId, tenantA.admin.id);
    const auditor = await dbCreateAuditor(tenantA.company.id, tenantA.admin.id);
    await createMember(team.id, auditor.id, "support_auditor", tenantA.admin.id, "completed");

    const result = await updateAuditor(auditor.id, tenantA.company.id, { status: "suspended" });

    expect("auditor" in result).toBe(true);
    if ("auditor" in result) expect(result.auditor.status).toBe("suspended");
  });
});

// ─── INV-05: equipo de report firmado es inmutable ───────────────────────────

describe("INV-05 — equipo vinculado a report firmado es inmutable", () => {
  it("rechaza modificar un miembro cuando el equipo está en un report firmado", async () => {
    const team = await dbCreateAuditTeam(tenantA.company.id, projectId, tenantA.admin.id);
    const auditor = await dbCreateAuditor(tenantA.company.id, tenantA.admin.id);
    const member = await createMember(team.id, auditor.id, "support_auditor", tenantA.admin.id, "confirmed");
    await createSignedReport(projectId, team.id, tenantA.admin.id);

    const result = await updateAuditTeamMember(
      member.id,
      team.id,
      tenantA.company.id,
      { status: "withdrawn" }
    );

    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toMatch(/informe firmado/);
  });
});

// ─── Audit trail ─────────────────────────────────────────────────────────────

describe("TRAIL — createdById se registra en todas las entidades", () => {
  it("auditor creado tiene createdById del admin", async () => {
    const result = await createAuditor({
      companyId: tenantA.company.id,
      name: "Trail Auditor",
      email: `trail-${Date.now()}@test.local`,
      createdById: tenantA.admin.id,
    });

    expect("auditor" in result).toBe(true);
  });

  it("AuditTeam creado tiene createdById del admin", async () => {
    const result = await createAuditTeam({
      companyId: tenantA.company.id,
      projectId,
      auditId: `TRAIL-${Date.now()}`,
      createdById: tenantA.admin.id,
    });

    expect("team" in result).toBe(true);
  });

  it("confirmedAt se puebla al confirmar un miembro", async () => {
    const team = await dbCreateAuditTeam(tenantA.company.id, projectId, tenantA.admin.id);
    const auditor = await dbCreateAuditor(tenantA.company.id, tenantA.admin.id);
    const member = await createMember(team.id, auditor.id, "support_auditor", tenantA.admin.id, "invited");

    const result = await updateAuditTeamMember(
      member.id,
      team.id,
      tenantA.company.id,
      { status: "confirmed" }
    );

    expect("member" in result).toBe(true);
    if ("member" in result) expect(result.member.confirmedAt).not.toBeNull();
  });
});
