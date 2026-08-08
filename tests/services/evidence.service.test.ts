import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/app/lib/prisma";
import {
  addEvidenceReportLink,
  addEvidenceRequirementLink,
  createEvidenceItem,
  createEvidenceValidation,
  deleteEvidenceItem,
  getEvidenceItem,
  listEvidenceItems,
  removeEvidenceRequirementLink,
  submitEvidenceItem,
  updateEvidenceItem,
} from "@/services/evidence.service";
import {
  createAuditReport,
  createAuditTeam,
  createEvidenceItem as fixtureEvidenceItem,
  createEvidenceValidation as fixtureValidation,
  createProject,
  createRequirement,
  createRequirementLink,
  createTenant,
  cleanupTenant,
} from "@/tests/helpers/db";

let tenantA: Awaited<ReturnType<typeof createTenant>>;
let tenantB: Awaited<ReturnType<typeof createTenant>>;
let projectA: Awaited<ReturnType<typeof createProject>>;
let projectB: Awaited<ReturnType<typeof createProject>>;
let auditTeamA: Awaited<ReturnType<typeof createAuditTeam>>;

/** Actor dueño del proyecto A. */
let ownerA: { userId: string; isAdmin: boolean };
/** Actor admin del tenant A — ve cualquier proyecto. */
let adminA: { userId: string; isAdmin: boolean };
/** Actor de otro tenant — no debe ver nada de A. */
let ownerB: { userId: string; isAdmin: boolean };

beforeAll(async () => {
  tenantA = await createTenant("svc-evidence-a");
  tenantB = await createTenant("svc-evidence-b");
  projectA = await createProject(tenantA.company.id, tenantA.user.id);
  projectB = await createProject(tenantB.company.id, tenantB.user.id);
  auditTeamA = await createAuditTeam(tenantA.company.id, projectA.id, tenantA.admin.id);

  ownerA = { userId: tenantA.user.id, isAdmin: false };
  adminA = { userId: tenantA.admin.id, isAdmin: true };
  ownerB = { userId: tenantB.user.id, isAdmin: false };
});

afterAll(async () => {
  await cleanupTenant(tenantA.company.id);
  await cleanupTenant(tenantB.company.id);
});

// ─── Tenant scope a nivel de servicio ────────────────────────────────────────

describe("Tenant scope", () => {
  it("el dueño ve su evidencia; otro tenant recibe null", async () => {
    const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id);

    expect(await getEvidenceItem(item.id, ownerA)).not.toBeNull();
    expect(await getEvidenceItem(item.id, ownerB)).toBeNull();
  });

  it("admin ve evidencia de cualquier proyecto", async () => {
    const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id);

    expect(await getEvidenceItem(item.id, adminA)).not.toBeNull();
  });

  it("listEvidenceItems devuelve notFound si el proyecto no es del actor", async () => {
    const result = await listEvidenceItems(projectB.id, ownerA);

    expect(result).toEqual({ notFound: true });
  });

  it("listEvidenceItems no filtra evidencia de otros proyectos", async () => {
    await fixtureEvidenceItem(projectA.id, tenantA.user.id, { title: "solo-de-A" });
    await fixtureEvidenceItem(projectB.id, tenantB.user.id, { title: "solo-de-B" });

    const result = await listEvidenceItems(projectA.id, ownerA);

    expect("items" in result).toBe(true);
    if (!("items" in result)) return;
    expect(result.items.every((i) => i.projectId === projectA.id)).toBe(true);
    expect(result.items.some((i) => i.title === "solo-de-B")).toBe(false);
  });
});

// ─── INV-01 ──────────────────────────────────────────────────────────────────

describe("INV-01 — ninguna evidencia llega a `validated` sin validacion humana", () => {
  it("outcome `approved` deja la evidencia en `validated` y registra quien valido", async () => {
    const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id, {
      status: "submitted",
    });

    const result = await createEvidenceValidation({
      evidenceItemId: item.id,
      outcome: "approved",
      validatedBy: tenantA.admin.id,
    });

    expect("validation" in result).toBe(true);
    if (!("validation" in result)) return;
    expect(result.evidenceStatus).toBe("validated");
    expect(result.validation.validatedBy).toBe(tenantA.admin.id);

    const stored = await prisma.evidenceItem.findUnique({ where: { id: item.id } });
    expect(stored?.status).toBe("validated");
  });

  it("una evidencia archivada no se puede validar", async () => {
    const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id, {
      status: "archived",
    });

    const result = await createEvidenceValidation({
      evidenceItemId: item.id,
      outcome: "approved",
      validatedBy: tenantA.admin.id,
    });

    expect("conflict" in result).toBe(true);
  });
});

// ─── INV-02 ──────────────────────────────────────────────────────────────────

describe("INV-02 — solo evidencia validada puede citarse en un informe", () => {
  it("citar evidencia en `draft` es conflicto", async () => {
    const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id);
    const report = await createAuditReport(
      projectA.id,
      auditTeamA.id,
      tenantA.admin.id,
      "draft"
    );

    const result = await addEvidenceReportLink({
      evidenceItemId: item.id,
      auditReportId: report.id,
      addedBy: tenantA.admin.id,
    });

    expect("conflict" in result).toBe(true);

    const links = await prisma.evidenceReportLink.count({
      where: { evidenceItemId: item.id },
    });
    expect(links).toBe(0);
  });

  it("citar evidencia `validated` en un informe abierto crea el vinculo", async () => {
    const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id);
    await fixtureValidation(item.id, tenantA.admin.id, "approved");
    const report = await createAuditReport(
      projectA.id,
      auditTeamA.id,
      tenantA.admin.id,
      "draft"
    );

    const result = await addEvidenceReportLink({
      evidenceItemId: item.id,
      auditReportId: report.id,
      addedBy: tenantA.admin.id,
    });

    expect("link" in result).toBe(true);
    if (!("link" in result)) return;
    expect(result.link.usedAs).toBe("supporting");
    expect(result.link.addedBy).toBe(tenantA.admin.id);
  });
});

// ─── INV-03 ──────────────────────────────────────────────────────────────────

describe("INV-03 — evidencia citada en un informe no se puede borrar", () => {
  it("borrar evidencia con un reportLink es conflicto y no la elimina", async () => {
    const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id);
    await fixtureValidation(item.id, tenantA.admin.id, "approved");
    const report = await createAuditReport(
      projectA.id,
      auditTeamA.id,
      tenantA.admin.id,
      "draft"
    );
    await addEvidenceReportLink({
      evidenceItemId: item.id,
      auditReportId: report.id,
      addedBy: tenantA.admin.id,
    });

    const result = await deleteEvidenceItem(item.id, adminA);

    expect("conflict" in result).toBe(true);
    const stored = await prisma.evidenceItem.findUnique({ where: { id: item.id } });
    expect(stored).not.toBeNull();
  });

  it("borrar evidencia sin reportLinks la elimina", async () => {
    const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id);

    const result = await deleteEvidenceItem(item.id, ownerA);

    expect(result).toEqual({ deleted: true, id: item.id });
    const stored = await prisma.evidenceItem.findUnique({ where: { id: item.id } });
    expect(stored).toBeNull();
  });
});

// ─── INV-04 / INV-05 / VER ───────────────────────────────────────────────────

describe("INV-04 / INV-05 — versionado monotono y coherente", () => {
  it("dos PATCH consecutivos generan las versiones 2 y 3", async () => {
    const { item } = (await createEvidenceItem(
      {
        projectId: projectA.id,
        title: "Version test",
        type: "document",
        createdBy: tenantA.user.id,
      },
      ownerA
    )) as { item: { id: string; version: number } };

    expect(item.version).toBe(1);

    await updateEvidenceItem(item.id, { title: "Segunda", updatedBy: tenantA.user.id }, ownerA);
    await updateEvidenceItem(item.id, { title: "Tercera", updatedBy: tenantA.user.id }, ownerA);

    const versions = await prisma.evidenceItemVersion.findMany({
      where: { evidenceItemId: item.id },
      orderBy: { version: "asc" },
      select: { version: true },
    });

    expect(versions.map((v) => v.version)).toEqual([1, 2, 3]);
  });

  it("EvidenceItem.version coincide con la version mas alta registrada", async () => {
    const { item } = (await createEvidenceItem(
      {
        projectId: projectA.id,
        title: "Coherencia",
        type: "record",
        createdBy: tenantA.user.id,
      },
      ownerA
    )) as { item: { id: string } };

    await updateEvidenceItem(item.id, { title: "Cambio", updatedBy: tenantA.user.id }, ownerA);

    const stored = await prisma.evidenceItem.findUnique({ where: { id: item.id } });
    const top = await prisma.evidenceItemVersion.findFirst({
      where: { evidenceItemId: item.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    expect(stored?.version).toBe(top?.version);
  });

  it("VER-01: cada PATCH añade exactamente un snapshot", async () => {
    const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id);
    const before = await prisma.evidenceItemVersion.count({
      where: { evidenceItemId: item.id },
    });

    await updateEvidenceItem(
      item.id,
      { description: "Descripcion nueva", updatedBy: tenantA.user.id },
      ownerA
    );

    const after = await prisma.evidenceItemVersion.count({
      where: { evidenceItemId: item.id },
    });
    expect(after).toBe(before + 1);
  });

  it("VER-02: el snapshot guarda el estado resultante de esa version", async () => {
    // El test-plan preveia el estado PREVIO; la implementacion fotografia el estado ya
    // actualizado a proposito (evidence.service.ts:151), para que el snapshot N describa
    // la version N y la invariante #5 se sostenga. Se testea el comportamiento real.
    const { item } = (await createEvidenceItem(
      {
        projectId: projectA.id,
        title: "Titulo original",
        type: "document",
        createdBy: tenantA.user.id,
      },
      ownerA
    )) as { item: { id: string } };

    await updateEvidenceItem(
      item.id,
      { title: "Titulo corregido", updatedBy: tenantA.user.id },
      ownerA
    );

    const v2 = await prisma.evidenceItemVersion.findFirst({
      where: { evidenceItemId: item.id, version: 2 },
    });
    const snapshot = v2?.snapshot as { title: string; version: number };

    expect(snapshot.title).toBe("Titulo corregido");
    expect(snapshot.version).toBe(2);
  });
});

// ─── Guarda de cambio real (VAL-09 a nivel de servicio) ──────────────────────

describe("updateEvidenceItem — exige al menos un campo de contenido", () => {
  it("una entrada sin campos no versiona ni toca la evidencia", async () => {
    const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id);
    const before = await prisma.evidenceItemVersion.count({
      where: { evidenceItemId: item.id },
    });

    const result = await updateEvidenceItem(
      item.id,
      { updatedBy: tenantA.user.id },
      ownerA
    );

    expect("invalid" in result).toBe(true);

    const after = await prisma.evidenceItemVersion.count({
      where: { evidenceItemId: item.id },
    });
    expect(after).toBe(before);

    const stored = await prisma.evidenceItem.findUnique({ where: { id: item.id } });
    expect(stored?.version).toBe(1);
    expect(stored?.updatedBy).toBeNull();
  });

  it("la guarda se aplica antes que el corte de tenant no revele nada de mas", async () => {
    // Evidencia ajena + entrada vacia: debe seguir siendo 'no encontrada', no 'invalida'.
    // El orden importa: filtrar por tenant primero evita confirmar que el id existe.
    const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id);

    const result = await updateEvidenceItem(
      item.id,
      { updatedBy: tenantB.user.id },
      ownerB
    );

    expect(result).toEqual({ notFound: true });
  });
});

// ─── INV-06 ──────────────────────────────────────────────────────────────────

describe("INV-06 — un vinculo contradictorio reabre la revision", () => {
  it("linkType `contradictory` pasa la evidencia a `under_review`", async () => {
    const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id, {
      status: "submitted",
    });
    const requirement = await createRequirement(projectA.id, "Req contradictorio");

    const result = await addEvidenceRequirementLink({
      evidenceItemId: item.id,
      requirementId: requirement.id,
      linkType: "contradictory",
      addedBy: tenantA.admin.id,
    });

    expect("link" in result).toBe(true);
    if (!("link" in result)) return;
    expect(result.evidenceStatus).toBe("under_review");

    const stored = await prisma.evidenceItem.findUnique({ where: { id: item.id } });
    expect(stored?.status).toBe("under_review");
  });

  it("linkType `supporting` no altera el estado", async () => {
    const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id, {
      status: "submitted",
    });
    const requirement = await createRequirement(projectA.id, "Req de apoyo");

    const result = await addEvidenceRequirementLink({
      evidenceItemId: item.id,
      requirementId: requirement.id,
      linkType: "supporting",
      addedBy: tenantA.admin.id,
    });

    expect("link" in result).toBe(true);
    const stored = await prisma.evidenceItem.findUnique({ where: { id: item.id } });
    expect(stored?.status).toBe("submitted");
  });

  it("un requisito de otro proyecto no se puede vincular", async () => {
    const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id);
    const requirementB = await createRequirement(projectB.id, "Req ajeno");

    const result = await addEvidenceRequirementLink({
      evidenceItemId: item.id,
      requirementId: requirementB.id,
      addedBy: tenantA.admin.id,
    });

    expect(result).toEqual({ notFound: "requirement" });
  });

  it("vincular dos veces la misma pareja es conflicto, no error 500", async () => {
    const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id);
    const requirement = await createRequirement(projectA.id, "Req duplicado");

    await addEvidenceRequirementLink({
      evidenceItemId: item.id,
      requirementId: requirement.id,
      addedBy: tenantA.admin.id,
    });
    const second = await addEvidenceRequirementLink({
      evidenceItemId: item.id,
      requirementId: requirement.id,
      addedBy: tenantA.admin.id,
    });

    expect("conflict" in second).toBe(true);
  });
});

// ─── INV-07 ──────────────────────────────────────────────────────────────────

describe("INV-07 — un informe cerrado no admite citas nuevas", () => {
  it.each(["signed", "finalizado"])(
    "informe en estado `%s` rechaza la cita",
    async (status) => {
      const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id);
      await fixtureValidation(item.id, tenantA.admin.id, "approved");
      const report = await createAuditReport(
        projectA.id,
        auditTeamA.id,
        tenantA.admin.id,
        status
      );

      const result = await addEvidenceReportLink({
        evidenceItemId: item.id,
        auditReportId: report.id,
        addedBy: tenantA.admin.id,
      });

      expect("conflict" in result).toBe(true);
    }
  );

  it("un informe de otro proyecto no se encuentra", async () => {
    const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id);
    await fixtureValidation(item.id, tenantA.admin.id, "approved");
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

    const result = await addEvidenceReportLink({
      evidenceItemId: item.id,
      auditReportId: reportB.id,
      addedBy: tenantA.admin.id,
    });

    expect(result).toEqual({ notFound: "report" });
  });
});

// ─── INV-08 ──────────────────────────────────────────────────────────────────

describe("INV-08 — borrar un requisito no arrastra la evidencia", () => {
  it("el vinculo cae en cascada pero el EvidenceItem sobrevive", async () => {
    const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id);
    const requirement = await createRequirement(projectA.id, "Req a borrar");
    const link = await createRequirementLink(item.id, requirement.id, tenantA.admin.id);

    await prisma.requirement.delete({ where: { id: requirement.id } });

    const storedLink = await prisma.evidenceRequirementLink.findUnique({
      where: { id: link.id },
    });
    const storedItem = await prisma.evidenceItem.findUnique({ where: { id: item.id } });

    expect(storedLink).toBeNull();
    expect(storedItem).not.toBeNull();
  });
});

// ─── INV-09 ──────────────────────────────────────────────────────────────────

describe("INV-09 — evidencia validada o archivada es inmutable via PATCH", () => {
  it.each(["validated", "archived"])(
    "editar evidencia en estado `%s` es conflicto",
    async (status) => {
      const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id, { status });

      const result = await updateEvidenceItem(
        item.id,
        { title: "Intento de cambio", updatedBy: tenantA.user.id },
        ownerA
      );

      expect("conflict" in result).toBe(true);

      const stored = await prisma.evidenceItem.findUnique({ where: { id: item.id } });
      expect(stored?.title).toBe("Test Evidence");
    }
  );
});

// ─── INV-10 ──────────────────────────────────────────────────────────────────

describe("INV-10 — flujo de rechazo", () => {
  it("`rejected` devuelve la evidencia a un estado editable y el PATCH la reingresa", async () => {
    const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id, {
      status: "submitted",
    });

    const validation = await createEvidenceValidation({
      evidenceItemId: item.id,
      outcome: "rejected",
      validatedBy: tenantA.admin.id,
    });
    expect("validation" in validation).toBe(true);
    if (!("validation" in validation)) return;
    expect(validation.evidenceStatus).toBe("rejected");

    const patched = await updateEvidenceItem(
      item.id,
      { title: "Corregida tras rechazo", updatedBy: tenantA.user.id },
      ownerA
    );

    expect("item" in patched).toBe(true);
    if (!("item" in patched)) return;
    // api-contract: una evidencia rechazada que se corrige reingresa al flujo.
    expect(patched.item.status).toBe("submitted");
  });

  it("`pending_clarification` deja la evidencia en `under_review`", async () => {
    const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id, {
      status: "submitted",
    });

    const result = await createEvidenceValidation({
      evidenceItemId: item.id,
      outcome: "pending_clarification",
      validatedBy: tenantA.admin.id,
    });

    expect("validation" in result).toBe(true);
    if (!("validation" in result)) return;
    expect(result.evidenceStatus).toBe("under_review");
  });
});

// ─── Transicion draft → submitted ────────────────────────────────────────────

describe("submitEvidenceItem", () => {
  it("pasa de `draft` a `submitted`", async () => {
    const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id);

    const result = await submitEvidenceItem(item.id, ownerA);

    expect("item" in result).toBe(true);
    if (!("item" in result)) return;
    expect(result.item.status).toBe("submitted");
  });

  it("solo admite `draft` como estado de partida", async () => {
    const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id, {
      status: "validated",
    });

    const result = await submitEvidenceItem(item.id, ownerA);

    expect("conflict" in result).toBe(true);
  });

  it("no encuentra evidencia de otro tenant", async () => {
    const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id);

    const result = await submitEvidenceItem(item.id, ownerB);

    expect(result).toEqual({ notFound: true });
  });
});

// ─── removeEvidenceRequirementLink ───────────────────────────────────────────

describe("removeEvidenceRequirementLink", () => {
  it("elimina el vinculo indicado", async () => {
    const item = await fixtureEvidenceItem(projectA.id, tenantA.user.id);
    const requirement = await createRequirement(projectA.id, "Req a desvincular");
    const link = await createRequirementLink(item.id, requirement.id, tenantA.admin.id);

    const result = await removeEvidenceRequirementLink(item.id, link.id);

    expect(result).toEqual({ deleted: true, id: link.id });
  });

  it("no elimina un vinculo que pertenece a otra evidencia", async () => {
    const itemOne = await fixtureEvidenceItem(projectA.id, tenantA.user.id);
    const itemTwo = await fixtureEvidenceItem(projectA.id, tenantA.user.id);
    const requirement = await createRequirement(projectA.id, "Req cruzado");
    const link = await createRequirementLink(itemOne.id, requirement.id, tenantA.admin.id);

    const result = await removeEvidenceRequirementLink(itemTwo.id, link.id);

    expect(result).toEqual({ notFound: true });
    const stored = await prisma.evidenceRequirementLink.findUnique({
      where: { id: link.id },
    });
    expect(stored).not.toBeNull();
  });
});
