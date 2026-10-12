import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { AuthUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { GET } from "@/app/api/requirements/route";
import {
  createEvidenceItem,
  createProject,
  createRequirementLink,
  createTenant,
  cleanupTenant,
} from "@/tests/helpers/db";
import { makeRequest, sessionCookie } from "@/tests/helpers/auth";

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

let tenant: Awaited<ReturnType<typeof createTenant>>;
let project: Awaited<ReturnType<typeof createProject>>;
let plantillaId: string;

beforeAll(async () => {
  tenant = await createTenant("api-criterio");
  project = await createProject(tenant.company.id, tenant.user.id);

  const plantilla = await prisma.requirementTemplate.create({
    data: {
      norma: "TEST-API-CRITERIO",
      item: "1.1",
      name: "TITULO",
      titulo: "TITULO",
      descripcion: "Descripcion",
      role: "adjudicador",
      criterioAceptacion: "Debe existir un BEP firmado.",
      defaultStatus: "no_conforme",
    },
  });
  plantillaId = plantilla.id;

  // Con plantilla: hereda el criterio por la relacion.
  await prisma.requirement.create({
    data: {
      projectId: project.id,
      templateId: plantillaId,
      name: "TITULO",
      titulo: "TITULO",
      descripcion: "Descripcion",
      norma: "TEST-API-CRITERIO",
      item: "1.1",
      status: "no_conforme",
    },
  });

  // Sin plantilla: importado del Excel de un proyecto, no tiene criterio.
  await prisma.requirement.create({
    data: {
      projectId: project.id,
      name: "SUELTO",
      titulo: "SUELTO",
      descripcion: "Descripcion",
      status: "no_conforme",
    },
  });
});

afterAll(async () => {
  await cleanupTenant(tenant.company.id);
  await prisma.requirementTemplate.delete({ where: { id: plantillaId } });
});

describe("GET /api/requirements", () => {
  it("devuelve el criterio de aceptacion de la plantilla", async () => {
    const cookie = sessionCookie(asAuthUser(tenant.user));
    const res = await GET(
      makeRequest(`/api/requirements?projectId=${project.id}`, { cookie })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    const conPlantilla = body.find((r: { name: string }) => r.name === "TITULO");
    expect(conPlantilla.criterioAceptacion).toBe("Debe existir un BEP firmado.");
  });

  it("devuelve null cuando el requisito no tiene plantilla", async () => {
    const cookie = sessionCookie(asAuthUser(tenant.user));
    const res = await GET(
      makeRequest(`/api/requirements?projectId=${project.id}`, { cookie })
    );
    const body = await res.json();

    const suelto = body.find((r: { name: string }) => r.name === "SUELTO");
    expect(suelto.criterioAceptacion).toBeNull();
  });

  it("devuelve los documentos presentados para cada requisito", async () => {
    const requisito = await prisma.requirement.findFirstOrThrow({
      where: { projectId: project.id, name: "SUELTO" },
    });
    const evidencia = await createEvidenceItem(project.id, tenant.user.id, {
      title: "BEP firmado.pdf",
    });
    const vinculo = await createRequirementLink(evidencia.id, requisito.id, tenant.user.id);

    const cookie = sessionCookie(asAuthUser(tenant.user));
    const res = await GET(
      makeRequest(`/api/requirements?projectId=${project.id}`, { cookie })
    );
    const body = await res.json();

    const suelto = body.find((r: { name: string }) => r.name === "SUELTO");
    expect(suelto.evidenceLinks).toEqual([
      {
        id: vinculo.id,
        linkType: vinculo.linkType,
        evidenceItem: { title: "BEP firmado.pdf" },
      },
    ]);
    const conPlantilla = body.find((r: { name: string }) => r.name === "TITULO");
    expect(conPlantilla.evidenceLinks).toEqual([]);
  });
});
