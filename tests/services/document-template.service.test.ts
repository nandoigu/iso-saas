import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { rm } from "fs/promises";
import { prisma } from "@/app/lib/prisma";
import {
  importDocumentTemplates,
  listApplicableTemplates,
  resolveTemplateFile,
} from "@/services/document-template.service";
import type { ParsedDocumentTemplateRow } from "@/services/document-template.types";
import { cleanupTenant, createTenant } from "../helpers/db";
import {
  SYNTHETIC_NORMA,
  SYNTHETIC_PREFIX,
  cleanupSyntheticDocumentTemplates,
  cleanupSyntheticRequirementTemplates,
  createSyntheticDocumentTemplate,
  createSyntheticRequirementTemplate,
  createSyntheticTemplatesDir,
} from "../helpers/document-templates";

const ACTA = "SYNTHETIC-svc-Acta.docx";
const MATRIZ = "SYNTHETIC-svc-Matriz.xlsx";

let tenant: Awaited<ReturnType<typeof createTenant>>;
let dir: string;
let req: Record<string, string>;

function fila(overrides: Partial<ParsedDocumentTemplateRow> = {}): ParsedDocumentTemplateRow {
  return {
    fila: 2,
    fichero: ACTA,
    nombre: "SYNTHETIC TEST DATA Acta",
    formato: "docx",
    vigente: true,
    roles: ["adjudicador", "adjudicatario_principal"],
    fase: "movilizacion",
    obligatoria: true,
    tipo: "ambas",
    referencias: [
      { norma: SYNTHETIC_NORMA, item: "1.1" },
      { norma: SYNTHETIC_NORMA, item: "2.1" },
    ],
    ...overrides,
  };
}

const importar = (rows: ParsedDocumentTemplateRow[]) =>
  importDocumentTemplates(rows, tenant.admin.id, { dir, ficheroPrefix: SYNTHETIC_PREFIX });

const sinteticas = () =>
  prisma.documentTemplate.findMany({
    where: { fichero: { startsWith: SYNTHETIC_PREFIX } },
    include: { requirementLinks: true, versions: { orderBy: { version: "asc" } } },
    orderBy: { fichero: "asc" },
  });

beforeAll(async () => {
  tenant = await createTenant("doc-templates-svc");
  dir = await createSyntheticTemplatesDir([ACTA, MATRIZ]);
  await cleanupSyntheticDocumentTemplates();
  await cleanupSyntheticRequirementTemplates();
  // 1.1 existe para adjudicador y adjudicatario; 2.1 solo para adjudicatario_principal.
  req = {
    adjudicador11: (await createSyntheticRequirementTemplate("1.1", "adjudicador")).id,
    adjudicatario11: (await createSyntheticRequirementTemplate("1.1", "adjudicatario")).id,
    principal21: (await createSyntheticRequirementTemplate("2.1", "adjudicatario_principal")).id,
  };
});

beforeEach(async () => {
  await cleanupSyntheticDocumentTemplates();
});

afterAll(async () => {
  await cleanupSyntheticDocumentTemplates();
  await cleanupSyntheticRequirementTemplates();
  await cleanupTenant(tenant.company.id);
  await rm(dir, { recursive: true, force: true });
});

describe("importDocumentTemplates", () => {
  it("crea la plantilla en version 1 y vincula cada requisito solo a los roles de la fila", async () => {
    const resultado = await importar([fila()]);

    expect(resultado).toEqual({
      ok: true,
      summary: { total: 1, created: 1, updated: 0, unchanged: 0, retired: 0, links: 2 },
    });
    const [plantilla] = await sinteticas();
    expect(plantilla.version).toBe(1);
    expect(plantilla.createdBy).toBe(tenant.admin.id);
    expect(plantilla.requirementLinks.map((l) => l.requirementTemplateId).sort()).toEqual(
      [req.adjudicador11, req.principal21].sort()
    );
    expect(plantilla.versions).toHaveLength(1);
    expect(plantilla.versions[0]).toMatchObject({ version: 1, importedBy: tenant.admin.id });
    expect(plantilla.versions[0].snapshot).toMatchObject({ fichero: ACTA, nombre: "SYNTHETIC TEST DATA Acta" });
  });

  it("es idempotente: reimportar lo mismo no crea version", async () => {
    await importar([fila()]);
    const resultado = await importar([fila()]);

    expect(resultado).toMatchObject({ ok: true, summary: { created: 0, updated: 0, unchanged: 1 } });
    const [plantilla] = await sinteticas();
    expect(plantilla.version).toBe(1);
    expect(plantilla.versions).toHaveLength(1);
  });

  it("un cambio crea la version 2 con el estado resultante", async () => {
    await importar([fila()]);
    const resultado = await importar([fila({ nombre: "SYNTHETIC TEST DATA Acta v2", referencias: [] })]);

    expect(resultado).toMatchObject({ ok: true, summary: { updated: 1, links: 0 } });
    const [plantilla] = await sinteticas();
    expect(plantilla.version).toBe(2);
    expect(plantilla.updatedBy).toBe(tenant.admin.id);
    expect(plantilla.requirementLinks).toEqual([]);
    expect(plantilla.versions[1]).toMatchObject({ version: 2 });
    expect(plantilla.versions[1].snapshot).toMatchObject({
      nombre: "SYNTHETIC TEST DATA Acta v2",
      requirementTemplateIds: [],
    });
  });

  it("retira sin borrar la plantilla que sale del libro, una sola vez", async () => {
    await importar([fila(), fila({ fila: 3, fichero: MATRIZ, formato: "xlsx", referencias: [] })]);

    const primera = await importar([fila()]);
    expect(primera).toMatchObject({ ok: true, summary: { retired: 1, unchanged: 1 } });
    const segunda = await importar([fila()]);
    expect(segunda).toMatchObject({ ok: true, summary: { retired: 0 } });

    const matriz = (await sinteticas()).find((p) => p.fichero === MATRIZ)!;
    expect(matriz.vigente).toBe(false);
    expect(matriz.version).toBe(2);
    expect(matriz.versions[1].snapshot).toMatchObject({ vigente: false });
  });

  it("falla entera si una referencia no existe para ningun rol de la fila", async () => {
    const resultado = await importar([
      fila({ fila: 2, fichero: MATRIZ, formato: "xlsx", referencias: [] }),
      fila({ fila: 3, referencias: [{ norma: SYNTHETIC_NORMA, item: "9.9" }] }),
    ]);

    expect(resultado).toEqual({
      ok: false,
      errors: [
        `Fila 3: el requisito ${SYNTHETIC_NORMA}/9.9 no existe para ningún rol de la fila (adjudicador, adjudicatario_principal).`,
      ],
    });
    expect(await sinteticas()).toEqual([]);
  });

  it("falla si el fichero no esta en el directorio de plantillas", async () => {
    const resultado = await importar([fila({ fichero: "SYNTHETIC-svc-no-existe.docx" })]);

    expect(resultado).toEqual({
      ok: false,
      errors: ["Fila 2: el fichero «SYNTHETIC-svc-no-existe.docx» no está en docs/fuentes/plantillas-iso/."],
    });
    expect(await sinteticas()).toEqual([]);
  });

  it("borrar un requisito vinculado lo impide la FK (Restrict)", async () => {
    await importar([fila()]);
    await expect(
      prisma.requirementTemplate.delete({ where: { id: req.adjudicador11 } })
    ).rejects.toMatchObject({ code: "P2003" });
  });
});

describe("listApplicableTemplates y resolveTemplateFile", () => {
  let ajeno: Awaited<ReturnType<typeof createTenant>>;
  let proyectoId: string;
  let ids: Record<string, string>;

  beforeAll(async () => {
    ajeno = await createTenant("doc-templates-svc-ajeno");
    proyectoId = (
      await prisma.project.create({
        data: { name: "SYNTHETIC proyecto", role: "adjudicatario", userId: tenant.user.id, companyId: tenant.company.id },
      })
    ).id;
  });

  beforeEach(async () => {
    await cleanupSyntheticDocumentTemplates();
    const crear = (o: Parameters<typeof createSyntheticDocumentTemplate>[1]) =>
      createSyntheticDocumentTemplate(tenant.admin.id, o).then((t) => t.id);
    ids = {
      cierre: await crear({ fichero: "SYNTHETIC-svc-Z-cierre.docx", nombre: "SYNTHETIC A cierre", fase: "cierre" }),
      ofertaB: await crear({ fichero: ACTA, nombre: "SYNTHETIC B oferta", fase: "oferta" }),
      ofertaA: await crear({ fichero: MATRIZ, nombre: "SYNTHETIC A oferta", fase: "oferta", formato: "xlsx" }),
      otroRol: await crear({ fichero: "SYNTHETIC-svc-otro-rol.docx", roles: ["adjudicador"] }),
      retirada: await crear({ fichero: "SYNTHETIC-svc-retirada.docx", vigente: false }),
      // Empieza por SYNTHETIC- para que la limpieza la borre, y resuelve fuera del directorio.
      maliciosa: await crear({ fichero: "SYNTHETIC-svc-x/../../fuera.docx", nombre: "SYNTHETIC C oferta fuera" }),
    };
  });

  afterAll(async () => {
    await cleanupSyntheticDocumentTemplates();
    await cleanupTenant(ajeno.company.id);
  });

  const dueno = () => ({ userId: tenant.user.id, isAdmin: false });

  it("lista solo vigentes del rol, por fase y nombre, sin el fichero", async () => {
    const resultado = await listApplicableTemplates(proyectoId, dueno());
    if ("notFound" in resultado) throw new Error("proyecto no encontrado");

    expect(resultado.projectRole).toBe("adjudicatario");
    // La maliciosa es vigente, del rol y de oferta: el listado la muestra porque no lee
    // disco; la descarga es la que la corta.
    const sinteticasListadas = resultado.templates.filter((t) => t.nombre.startsWith("SYNTHETIC"));
    expect(sinteticasListadas.map((t) => t.nombre)).toEqual([
      "SYNTHETIC A oferta",
      "SYNTHETIC B oferta",
      "SYNTHETIC C oferta fuera",
      "SYNTHETIC A cierre",
    ]);
    expect(resultado.templates.map((t) => t.id)).not.toContain(ids.otroRol);
    expect(resultado.templates.map((t) => t.id)).not.toContain(ids.retirada);
    expect(Object.keys(resultado.templates[0]).sort()).toEqual(
      ["fase", "formato", "id", "nombre", "obligatoria", "tipo"]
    );
  });

  it("proyecto ajeno es notFound; un admin lo ve", async () => {
    expect(await listApplicableTemplates(proyectoId, { userId: ajeno.user.id, isAdmin: false })).toEqual({ notFound: true });
    expect(await listApplicableTemplates(proyectoId, { userId: ajeno.admin.id, isAdmin: true })).toMatchObject({
      projectRole: "adjudicatario",
    });
  });

  it("resuelve el fichero aplicable con su tamano", async () => {
    const r = await resolveTemplateFile(proyectoId, ids.ofertaB, dueno(), dir);
    expect(r).toMatchObject({ fichero: ACTA, formato: "docx", size: `SYNTHETIC TEST DATA ${ACTA}`.length });
  });

  it.each(["otroRol", "retirada", "maliciosa"])("%s es notFound", async (clave) => {
    expect(await resolveTemplateFile(proyectoId, ids[clave], dueno(), dir)).toEqual({ notFound: true });
  });

  it("plantilla inexistente y proyecto ajeno son notFound", async () => {
    expect(await resolveTemplateFile(proyectoId, "no-existe", dueno(), dir)).toEqual({ notFound: true });
    expect(
      await resolveTemplateFile(proyectoId, ids.ofertaB, { userId: ajeno.user.id, isAdmin: false }, dir)
    ).toEqual({ notFound: true });
  });

  it("binario ausente es missing", async () => {
    expect(await resolveTemplateFile(proyectoId, ids.cierre, dueno(), dir)).toEqual({
      missing: true,
      fichero: "SYNTHETIC-svc-Z-cierre.docx",
    });
  });
});
