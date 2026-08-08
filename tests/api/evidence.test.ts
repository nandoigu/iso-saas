import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/app/lib/prisma";
import {
  GET as LIST_EVIDENCE,
  POST as CREATE_EVIDENCE,
} from "@/app/api/projects/[id]/evidence/route";
import { POST as UPLOAD_TOKEN } from "@/app/api/projects/[id]/evidence/upload-token/route";
import {
  GET as GET_EVIDENCE,
  PATCH as PATCH_EVIDENCE,
  DELETE as DELETE_EVIDENCE,
} from "@/app/api/evidence/[evidenceId]/route";
import { POST as SUBMIT_EVIDENCE } from "@/app/api/evidence/[evidenceId]/submit/route";
import { GET as GET_FILE } from "@/app/api/evidence/[evidenceId]/file/route";
import { POST as ADD_REQUIREMENT_LINK } from "@/app/api/admin/evidence/[evidenceId]/requirement-links/route";
import { DELETE as REMOVE_REQUIREMENT_LINK } from "@/app/api/admin/evidence/[evidenceId]/requirement-links/[linkId]/route";
import { POST as VALIDATE_EVIDENCE } from "@/app/api/admin/evidence/[evidenceId]/validate/route";
import { POST as ADD_REPORT_LINK } from "@/app/api/admin/evidence/[evidenceId]/report-links/route";
import { sessionCookie, makeRequest } from "@/tests/helpers/auth";
import {
  createAuditReport,
  createAuditTeam,
  createEvidenceItem,
  createEvidenceValidation,
  createProject,
  createRequirement,
  createRequirementLink,
  createTenant,
  cleanupTenant,
} from "@/tests/helpers/db";
import type { AuthUser } from "@/app/lib/auth";

let tenantA: Awaited<ReturnType<typeof createTenant>>;
let tenantB: Awaited<ReturnType<typeof createTenant>>;
let projectA: Awaited<ReturnType<typeof createProject>>;
let projectB: Awaited<ReturnType<typeof createProject>>;
let auditTeamA: Awaited<ReturnType<typeof createAuditTeam>>;

let ownerCookie: string;
let adminCookie: string;
let strangerCookie: string;

function asAuthUser(user: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  companyId: string | null;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    companyId: user.companyId,
  };
}

const evidenceCtx = (evidenceId: string) => ({ params: Promise.resolve({ evidenceId }) });
const projectCtx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  tenantA = await createTenant("api-evidence-a");
  tenantB = await createTenant("api-evidence-b");
  projectA = await createProject(tenantA.company.id, tenantA.user.id);
  projectB = await createProject(tenantB.company.id, tenantB.user.id);
  auditTeamA = await createAuditTeam(tenantA.company.id, projectA.id, tenantA.admin.id);

  ownerCookie = sessionCookie(asAuthUser(tenantA.user));
  adminCookie = sessionCookie(asAuthUser(tenantA.admin));
  strangerCookie = sessionCookie(asAuthUser(tenantB.user));
});

afterAll(async () => {
  await cleanupTenant(tenantA.company.id);
  await cleanupTenant(tenantB.company.id);
});

// ─── AUTH ─────────────────────────────────────────────────────────────────────

describe("AUTH — autenticacion", () => {
  it("AUTH-01: ningun endpoint responde sin cookie de sesion", async () => {
    const anyId = "no-importa";
    const responses = await Promise.all([
      LIST_EVIDENCE(makeRequest(`/api/projects/${projectA.id}/evidence`), projectCtx(projectA.id)),
      CREATE_EVIDENCE(
        makeRequest(`/api/projects/${projectA.id}/evidence`, { method: "POST", body: {} }),
        projectCtx(projectA.id)
      ),
      UPLOAD_TOKEN(
        makeRequest(`/api/projects/${projectA.id}/evidence/upload-token`, { method: "POST" }),
        projectCtx(projectA.id)
      ),
      GET_EVIDENCE(makeRequest(`/api/evidence/${anyId}`), evidenceCtx(anyId)),
      PATCH_EVIDENCE(
        makeRequest(`/api/evidence/${anyId}`, { method: "PATCH", body: { title: "x" } }),
        evidenceCtx(anyId)
      ),
      DELETE_EVIDENCE(
        makeRequest(`/api/evidence/${anyId}`, { method: "DELETE" }),
        evidenceCtx(anyId)
      ),
      SUBMIT_EVIDENCE(
        makeRequest(`/api/evidence/${anyId}/submit`, { method: "POST" }),
        evidenceCtx(anyId)
      ),
      GET_FILE(makeRequest(`/api/evidence/${anyId}/file`), evidenceCtx(anyId)),
      ADD_REQUIREMENT_LINK(
        makeRequest(`/api/admin/evidence/${anyId}/requirement-links`, {
          method: "POST",
          body: {},
        }),
        evidenceCtx(anyId)
      ),
      REMOVE_REQUIREMENT_LINK(
        makeRequest(`/api/admin/evidence/${anyId}/requirement-links/link`, {
          method: "DELETE",
        }),
        { params: Promise.resolve({ evidenceId: anyId, linkId: "link" }) }
      ),
      VALIDATE_EVIDENCE(
        makeRequest(`/api/admin/evidence/${anyId}/validate`, { method: "POST", body: {} }),
        evidenceCtx(anyId)
      ),
      ADD_REPORT_LINK(
        makeRequest(`/api/admin/evidence/${anyId}/report-links`, { method: "POST", body: {} }),
        evidenceCtx(anyId)
      ),
    ]);

    expect(responses.map((r) => r.status)).toEqual(Array(12).fill(401));
  });
});

describe("AUTH — RBAC de las rutas admin", () => {
  it("AUTH-03: un usuario no-admin no puede vincular evidencia a requisitos", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);
    const res = await ADD_REQUIREMENT_LINK(
      makeRequest(`/api/admin/evidence/${item.id}/requirement-links`, {
        method: "POST",
        cookie: ownerCookie,
        body: { requirementId: "cualquiera" },
      }),
      evidenceCtx(item.id)
    );
    expect(res.status).toBe(403);
  });

  it("AUTH-04: un usuario no-admin no puede validar evidencia", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);
    const res = await VALIDATE_EVIDENCE(
      makeRequest(`/api/admin/evidence/${item.id}/validate`, {
        method: "POST",
        cookie: ownerCookie,
        body: { outcome: "approved" },
      }),
      evidenceCtx(item.id)
    );
    expect(res.status).toBe(403);

    // El corte es real, no cosmetico: la evidencia sigue sin validar.
    const stored = await prisma.evidenceItem.findUnique({ where: { id: item.id } });
    expect(stored?.status).toBe("draft");
  });

  it("AUTH-05: un usuario no-admin no puede citar evidencia en un informe", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);
    const res = await ADD_REPORT_LINK(
      makeRequest(`/api/admin/evidence/${item.id}/report-links`, {
        method: "POST",
        cookie: ownerCookie,
        body: { auditReportId: "cualquiera" },
      }),
      evidenceCtx(item.id)
    );
    expect(res.status).toBe(403);
  });

  it("AUTH-05b: un usuario no-admin no puede eliminar un vinculo a requisito", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);
    const requirement = await createRequirement(projectA.id, "Req rbac");
    const link = await createRequirementLink(item.id, requirement.id, tenantA.admin.id);

    const res = await REMOVE_REQUIREMENT_LINK(
      makeRequest(`/api/admin/evidence/${item.id}/requirement-links/${link.id}`, {
        method: "DELETE",
        cookie: ownerCookie,
      }),
      { params: Promise.resolve({ evidenceId: item.id, linkId: link.id }) }
    );

    expect(res.status).toBe(403);
    const stored = await prisma.evidenceRequirementLink.findUnique({
      where: { id: link.id },
    });
    expect(stored).not.toBeNull();
  });
});

// ─── TENANT ───────────────────────────────────────────────────────────────────

describe("TENANT — aislamiento de tenant", () => {
  it("TENANT-01: GET evidencia de otro usuario devuelve 404, no 403", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);

    const res = await GET_EVIDENCE(
      makeRequest(`/api/evidence/${item.id}`, { cookie: strangerCookie }),
      evidenceCtx(item.id)
    );

    expect(res.status).toBe(404);
  });

  it("TENANT-02: listar evidencia de un proyecto ajeno devuelve 404", async () => {
    const res = await LIST_EVIDENCE(
      makeRequest(`/api/projects/${projectB.id}/evidence`, { cookie: ownerCookie }),
      projectCtx(projectB.id)
    );

    expect(res.status).toBe(404);
  });

  it("TENANT-03: la lista no filtra evidencia de otros proyectos", async () => {
    await createEvidenceItem(projectA.id, tenantA.user.id, { title: "visible-A" });
    await createEvidenceItem(projectB.id, tenantB.user.id, { title: "oculta-B" });

    const res = await LIST_EVIDENCE(
      makeRequest(`/api/projects/${projectA.id}/evidence`, { cookie: ownerCookie }),
      projectCtx(projectA.id)
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(
      json.data.every((i: { projectId: string }) => i.projectId === projectA.id)
    ).toBe(true);
    expect(json.data.some((i: { title: string }) => i.title === "oculta-B")).toBe(false);
  });

  it("TENANT-04: vincular un requisito de otro proyecto devuelve 404", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);
    const requirementB = await createRequirement(projectB.id, "Req de B");

    const res = await ADD_REQUIREMENT_LINK(
      makeRequest(`/api/admin/evidence/${item.id}/requirement-links`, {
        method: "POST",
        cookie: adminCookie,
        body: { requirementId: requirementB.id },
      }),
      evidenceCtx(item.id)
    );

    expect(res.status).toBe(404);
  });

  it("TENANT-05: citar un informe de otro tenant devuelve 404", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);
    await createEvidenceValidation(item.id, tenantA.admin.id, "approved");
    const auditTeamB = await createAuditTeam(
      tenantB.company.id,
      projectB.id,
      tenantB.admin.id
    );
    const reportB = await createAuditReport(
      projectB.id,
      auditTeamB.id,
      tenantB.admin.id,
      "draft"
    );

    const res = await ADD_REPORT_LINK(
      makeRequest(`/api/admin/evidence/${item.id}/report-links`, {
        method: "POST",
        cookie: adminCookie,
        body: { auditReportId: reportB.id },
      }),
      evidenceCtx(item.id)
    );

    expect(res.status).toBe(404);
  });

  it("TENANT-06: PATCH sobre evidencia ajena devuelve 404 y no la modifica", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);

    const res = await PATCH_EVIDENCE(
      makeRequest(`/api/evidence/${item.id}`, {
        method: "PATCH",
        cookie: strangerCookie,
        body: { title: "Secuestrada" },
      }),
      evidenceCtx(item.id)
    );

    expect(res.status).toBe(404);
    const stored = await prisma.evidenceItem.findUnique({ where: { id: item.id } });
    expect(stored?.title).toBe("Test Evidence");
  });

  it("TENANT-07: admin accede a la evidencia de cualquier proyecto", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);

    const res = await GET_EVIDENCE(
      makeRequest(`/api/evidence/${item.id}`, { cookie: adminCookie }),
      evidenceCtx(item.id)
    );

    expect(res.status).toBe(200);
  });

  it("TENANT-08: el token de subida no se emite para un proyecto ajeno", async () => {
    const res = await UPLOAD_TOKEN(
      makeRequest(`/api/projects/${projectB.id}/evidence/upload-token`, {
        method: "POST",
        cookie: ownerCookie,
      }),
      projectCtx(projectB.id)
    );

    expect(res.status).toBe(404);
  });
});

// ─── HP ───────────────────────────────────────────────────────────────────────

describe("HP — happy path", () => {
  it("HP-01: crear evidencia devuelve 201 en estado draft", async () => {
    const res = await CREATE_EVIDENCE(
      makeRequest(`/api/projects/${projectA.id}/evidence`, {
        method: "POST",
        cookie: ownerCookie,
        body: { title: "Acta de reunion", type: "record" },
      }),
      projectCtx(projectA.id)
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.status).toBe("draft");
    expect(json.data.version).toBe(1);
    expect(json.data.projectId).toBe(projectA.id);
  });

  it("HP-02: listar evidencia devuelve 200 y un array", async () => {
    const res = await LIST_EVIDENCE(
      makeRequest(`/api/projects/${projectA.id}/evidence`, { cookie: ownerCookie }),
      projectCtx(projectA.id)
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(json.data)).toBe(true);
  });

  it("HP-03: el detalle incluye vinculos y validaciones vacios al inicio", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);

    const res = await GET_EVIDENCE(
      makeRequest(`/api/evidence/${item.id}`, { cookie: ownerCookie }),
      evidenceCtx(item.id)
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.requirementLinks).toEqual([]);
    expect(json.data.reportLinks).toEqual([]);
    expect(json.data.validations).toEqual([]);
  });

  it("HP-04: PATCH actualiza el contenido y sube a la version 2", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);

    const res = await PATCH_EVIDENCE(
      makeRequest(`/api/evidence/${item.id}`, {
        method: "PATCH",
        cookie: ownerCookie,
        body: { title: "Titulo corregido", description: "Con contexto" },
      }),
      evidenceCtx(item.id)
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.title).toBe("Titulo corregido");
    expect(json.data.description).toBe("Con contexto");
    expect(json.data.version).toBe(2);
  });

  it("HP-05: DELETE sin citas elimina la evidencia", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);

    const res = await DELETE_EVIDENCE(
      makeRequest(`/api/evidence/${item.id}`, { method: "DELETE", cookie: ownerCookie }),
      evidenceCtx(item.id)
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deleted).toBe(true);
  });

  it("HP-06: admin vincula evidencia a requisito con 201", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);
    const requirement = await createRequirement(projectA.id, "Req hp06");

    const res = await ADD_REQUIREMENT_LINK(
      makeRequest(`/api/admin/evidence/${item.id}/requirement-links`, {
        method: "POST",
        cookie: adminCookie,
        body: { requirementId: requirement.id, linkType: "supporting" },
      }),
      evidenceCtx(item.id)
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.linkType).toBe("supporting");
    // TRAIL-04: el autor sale de la sesion, nunca del body.
    expect(json.data.addedBy).toBe(tenantA.admin.id);
  });

  it("HP-07: admin elimina el vinculo a requisito", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);
    const requirement = await createRequirement(projectA.id, "Req hp07");
    const link = await createRequirementLink(item.id, requirement.id, tenantA.admin.id);

    const res = await REMOVE_REQUIREMENT_LINK(
      makeRequest(`/api/admin/evidence/${item.id}/requirement-links/${link.id}`, {
        method: "DELETE",
        cookie: adminCookie,
      }),
      { params: Promise.resolve({ evidenceId: item.id, linkId: link.id }) }
    );

    expect(res.status).toBe(200);
  });

  it("HP-08: validar con `approved` devuelve 201 y deja la evidencia validada", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id, {
      status: "submitted",
    });

    const res = await VALIDATE_EVIDENCE(
      makeRequest(`/api/admin/evidence/${item.id}/validate`, {
        method: "POST",
        cookie: adminCookie,
        body: { outcome: "approved", notes: "Conforme" },
      }),
      evidenceCtx(item.id)
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.evidenceStatus).toBe("validated");
    // TRAIL-03: `validatedBy` sale de la sesion del admin.
    expect(json.data.validatedBy).toBe(tenantA.admin.id);
  });

  it("HP-09: citar evidencia validada en un informe abierto devuelve 201", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);
    await createEvidenceValidation(item.id, tenantA.admin.id, "approved");
    const report = await createAuditReport(
      projectA.id,
      auditTeamA.id,
      tenantA.admin.id,
      "draft"
    );

    const res = await ADD_REPORT_LINK(
      makeRequest(`/api/admin/evidence/${item.id}/report-links`, {
        method: "POST",
        cookie: adminCookie,
        body: { auditReportId: report.id, usedAs: "conclusion_basis" },
      }),
      evidenceCtx(item.id)
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.usedAs).toBe("conclusion_basis");
  });

  it("HP-11: el dueño presenta la evidencia a revision", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);

    const res = await SUBMIT_EVIDENCE(
      makeRequest(`/api/evidence/${item.id}/submit`, {
        method: "POST",
        cookie: ownerCookie,
      }),
      evidenceCtx(item.id)
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe("submitted");
  });
});

// ─── INV a nivel de API ───────────────────────────────────────────────────────

describe("INV — las invariantes se traducen a 409 en la API", () => {
  it("INV-02: citar evidencia sin validar devuelve 409", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);
    const report = await createAuditReport(
      projectA.id,
      auditTeamA.id,
      tenantA.admin.id,
      "draft"
    );

    const res = await ADD_REPORT_LINK(
      makeRequest(`/api/admin/evidence/${item.id}/report-links`, {
        method: "POST",
        cookie: adminCookie,
        body: { auditReportId: report.id },
      }),
      evidenceCtx(item.id)
    );

    expect(res.status).toBe(409);
  });

  it("INV-03: borrar evidencia citada devuelve 409", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);
    await createEvidenceValidation(item.id, tenantA.admin.id, "approved");
    const report = await createAuditReport(
      projectA.id,
      auditTeamA.id,
      tenantA.admin.id,
      "draft"
    );
    await ADD_REPORT_LINK(
      makeRequest(`/api/admin/evidence/${item.id}/report-links`, {
        method: "POST",
        cookie: adminCookie,
        body: { auditReportId: report.id },
      }),
      evidenceCtx(item.id)
    );

    const res = await DELETE_EVIDENCE(
      makeRequest(`/api/evidence/${item.id}`, { method: "DELETE", cookie: adminCookie }),
      evidenceCtx(item.id)
    );

    expect(res.status).toBe(409);
  });

  it("INV-07: citar en un informe firmado devuelve 409", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);
    await createEvidenceValidation(item.id, tenantA.admin.id, "approved");
    const report = await createAuditReport(
      projectA.id,
      auditTeamA.id,
      tenantA.admin.id,
      "signed"
    );

    const res = await ADD_REPORT_LINK(
      makeRequest(`/api/admin/evidence/${item.id}/report-links`, {
        method: "POST",
        cookie: adminCookie,
        body: { auditReportId: report.id },
      }),
      evidenceCtx(item.id)
    );

    expect(res.status).toBe(409);
  });

  it("INV-09: editar evidencia validada devuelve 409", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id, {
      status: "validated",
    });

    const res = await PATCH_EVIDENCE(
      makeRequest(`/api/evidence/${item.id}`, {
        method: "PATCH",
        cookie: ownerCookie,
        body: { title: "Intento de cambio" },
      }),
      evidenceCtx(item.id)
    );

    expect(res.status).toBe(409);
  });
});

// ─── VAL ──────────────────────────────────────────────────────────────────────

describe("VAL — validacion de entrada", () => {
  it("VAL-01: crear evidencia sin titulo devuelve 400", async () => {
    const res = await CREATE_EVIDENCE(
      makeRequest(`/api/projects/${projectA.id}/evidence`, {
        method: "POST",
        cookie: ownerCookie,
        body: { type: "document" },
      }),
      projectCtx(projectA.id)
    );
    expect(res.status).toBe(400);
  });

  it("VAL-02: crear evidencia con tipo invalido devuelve 400", async () => {
    const res = await CREATE_EVIDENCE(
      makeRequest(`/api/projects/${projectA.id}/evidence`, {
        method: "POST",
        cookie: ownerCookie,
        body: { title: "Algo", type: "planoDWG" },
      }),
      projectCtx(projectA.id)
    );
    expect(res.status).toBe(400);
  });

  it("VAL-03: el projectId del body se ignora y prevalece el de la ruta", async () => {
    const res = await CREATE_EVIDENCE(
      makeRequest(`/api/projects/${projectA.id}/evidence`, {
        method: "POST",
        cookie: ownerCookie,
        body: { title: "Ruta manda", type: "document", projectId: projectB.id },
      }),
      projectCtx(projectA.id)
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.projectId).toBe(projectA.id);
  });

  it("VAL-04: vincular sin requirementId devuelve 400", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);
    const res = await ADD_REQUIREMENT_LINK(
      makeRequest(`/api/admin/evidence/${item.id}/requirement-links`, {
        method: "POST",
        cookie: adminCookie,
        body: {},
      }),
      evidenceCtx(item.id)
    );
    expect(res.status).toBe(400);
  });

  it("VAL-05: linkType invalido devuelve 400", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);
    const requirement = await createRequirement(projectA.id, "Req val05");
    const res = await ADD_REQUIREMENT_LINK(
      makeRequest(`/api/admin/evidence/${item.id}/requirement-links`, {
        method: "POST",
        cookie: adminCookie,
        body: { requirementId: requirement.id, linkType: "quiza" },
      }),
      evidenceCtx(item.id)
    );
    expect(res.status).toBe(400);
  });

  it("VAL-06: validar sin outcome devuelve 400", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);
    const res = await VALIDATE_EVIDENCE(
      makeRequest(`/api/admin/evidence/${item.id}/validate`, {
        method: "POST",
        cookie: adminCookie,
        body: {},
      }),
      evidenceCtx(item.id)
    );
    expect(res.status).toBe(400);
  });

  it("VAL-07: outcome invalido devuelve 400", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);
    const res = await VALIDATE_EVIDENCE(
      makeRequest(`/api/admin/evidence/${item.id}/validate`, {
        method: "POST",
        cookie: adminCookie,
        body: { outcome: "casi" },
      }),
      evidenceCtx(item.id)
    );
    expect(res.status).toBe(400);
  });

  it("VAL-08: citar sin auditReportId devuelve 400", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);
    const res = await ADD_REPORT_LINK(
      makeRequest(`/api/admin/evidence/${item.id}/report-links`, {
        method: "POST",
        cookie: adminCookie,
        body: {},
      }),
      evidenceCtx(item.id)
    );
    expect(res.status).toBe(400);
  });

  it("VAL-09: PATCH con cuerpo vacio devuelve 400 y no crea version", async () => {
    // Pregunta abierta del test-plan, resuelta por la implementacion: 400, no no-op.
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);
    const before = await prisma.evidenceItemVersion.count({
      where: { evidenceItemId: item.id },
    });

    const res = await PATCH_EVIDENCE(
      makeRequest(`/api/evidence/${item.id}`, {
        method: "PATCH",
        cookie: ownerCookie,
        body: {},
      }),
      evidenceCtx(item.id)
    );

    expect(res.status).toBe(400);
    const after = await prisma.evidenceItemVersion.count({
      where: { evidenceItemId: item.id },
    });
    expect(after).toBe(before);
  });

  it("VAL-10: PATCH con titulo en blanco devuelve 400", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);
    const res = await PATCH_EVIDENCE(
      makeRequest(`/api/evidence/${item.id}`, {
        method: "PATCH",
        cookie: ownerCookie,
        body: { title: "   " },
      }),
      evidenceCtx(item.id)
    );
    expect(res.status).toBe(400);
  });
});

// ─── TRAIL ────────────────────────────────────────────────────────────────────

describe("TRAIL — audit trail", () => {
  it("TRAIL-01: `createdBy` sale de la sesion, no del body", async () => {
    const res = await CREATE_EVIDENCE(
      makeRequest(`/api/projects/${projectA.id}/evidence`, {
        method: "POST",
        cookie: ownerCookie,
        body: { title: "Trazabilidad", type: "document", createdBy: tenantB.user.id },
      }),
      projectCtx(projectA.id)
    );
    const json = await res.json();

    expect(json.data.createdBy).toBe(tenantA.user.id);
  });

  it("TRAIL-02: `updatedBy` registra a quien edita", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);

    await PATCH_EVIDENCE(
      makeRequest(`/api/evidence/${item.id}`, {
        method: "PATCH",
        cookie: adminCookie,
        body: { title: "Editado por el admin" },
      }),
      evidenceCtx(item.id)
    );

    const stored = await prisma.evidenceItem.findUnique({ where: { id: item.id } });
    expect(stored?.updatedBy).toBe(tenantA.admin.id);
  });
});

// ─── FILE ─────────────────────────────────────────────────────────────────────

describe("FILE — acceso al binario", () => {
  it("FILE-01: sin `sourceRef` devuelve 404", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id);

    const res = await GET_FILE(
      makeRequest(`/api/evidence/${item.id}/file`, { cookie: ownerCookie }),
      evidenceCtx(item.id)
    );

    expect(res.status).toBe(404);
  });

  it("FILE-03: evidencia de otro tenant devuelve 404 antes de tocar el Blob", async () => {
    const item = await createEvidenceItem(projectA.id, tenantA.user.id, {
      sourceRef: "evidence/projectA/plano.pdf",
    });

    const res = await GET_FILE(
      makeRequest(`/api/evidence/${item.id}/file`, { cookie: strangerCookie }),
      evidenceCtx(item.id)
    );

    expect(res.status).toBe(404);
  });

  it("FASE D: con `sourceRef` y permisos correctos responde 501 hasta integrar Blob", async () => {
    // HP-10/FILE-02 del test-plan esperan 200 + signed URL. Quedan pendientes de la
    // Fase D; este test fija el contrato provisional para que el cambio sea visible.
    const item = await createEvidenceItem(projectA.id, tenantA.user.id, {
      sourceRef: "evidence/projectA/plano.pdf",
    });

    const res = await GET_FILE(
      makeRequest(`/api/evidence/${item.id}/file`, { cookie: ownerCookie }),
      evidenceCtx(item.id)
    );

    expect(res.status).toBe(501);
  });

  it("FASE D: el token de subida responde 501 sobre un proyecto propio", async () => {
    const res = await UPLOAD_TOKEN(
      makeRequest(`/api/projects/${projectA.id}/evidence/upload-token`, {
        method: "POST",
        cookie: ownerCookie,
      }),
      projectCtx(projectA.id)
    );

    expect(res.status).toBe(501);
  });
});
