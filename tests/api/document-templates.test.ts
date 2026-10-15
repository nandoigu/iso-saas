import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { rm } from "fs/promises";
import { prisma } from "@/app/lib/prisma";

// El directorio real no se toca: las rutas leen de uno temporal con ficheros SYNTHETIC.
const plantillas = vi.hoisted(() => ({ dir: "" }));
vi.mock("@/services/document-template.paths", () => ({
  getPlantillasDir: () => plantillas.dir,
}));

import { GET as LIST } from "@/app/api/projects/[id]/document-templates/route";
import { GET as FILE } from "@/app/api/projects/[id]/document-templates/[templateId]/file/route";
import { cleanupTenant, createTenant } from "../helpers/db";
import { makeRequest, sessionCookie } from "../helpers/auth";
import {
  cleanupSyntheticDocumentTemplates,
  createSyntheticDocumentTemplate,
  createSyntheticTemplatesDir,
} from "../helpers/document-templates";

const ACTA = "SYNTHETIC-api-Acta Aprobación.docx";
const MATRIZ = "SYNTHETIC-api-Matriz.xlsx";

let a: Awaited<ReturnType<typeof createTenant>>;
let b: Awaited<ReturnType<typeof createTenant>>;
let proyectoId: string;
let ids: Record<string, string>;

const listCtx = (id: string) => ({ params: Promise.resolve({ id }) });
const fileCtx = (id: string, templateId: string) => ({ params: Promise.resolve({ id, templateId }) });
const urlFichero = (id: string, templateId: string) =>
  `/api/projects/${id}/document-templates/${templateId}/file`;

beforeAll(async () => {
  a = await createTenant("doc-templates-api-a");
  b = await createTenant("doc-templates-api-b");
  plantillas.dir = await createSyntheticTemplatesDir([ACTA, MATRIZ]);
  await cleanupSyntheticDocumentTemplates();
  proyectoId = (
    await prisma.project.create({
      data: { name: "SYNTHETIC proyecto", role: "adjudicatario", userId: a.user.id, companyId: a.company.id },
    })
  ).id;
  const crear = (o: Parameters<typeof createSyntheticDocumentTemplate>[1]) =>
    createSyntheticDocumentTemplate(a.admin.id, o).then((t) => t.id);
  ids = {
    acta: await crear({ fichero: ACTA }),
    matriz: await crear({ fichero: MATRIZ, formato: "xlsx" }),
    otroRol: await crear({ fichero: "SYNTHETIC-api-otro-rol.docx", roles: ["adjudicador"] }),
    retirada: await crear({ fichero: "SYNTHETIC-api-retirada.docx", vigente: false }),
    sinBinario: await crear({ fichero: "SYNTHETIC-api-sin-binario.docx" }),
  };
});

afterAll(async () => {
  await cleanupSyntheticDocumentTemplates();
  await cleanupTenant(a.company.id);
  await cleanupTenant(b.company.id);
  await rm(plantillas.dir, { recursive: true, force: true });
});

describe("GET /api/projects/[id]/document-templates", () => {
  it("401 sin sesion", async () => {
    const res = await LIST(makeRequest(`/api/projects/${proyectoId}/document-templates`), listCtx(proyectoId));
    expect(res.status).toBe(401);
  });

  it("200 al dueno, con las aplicables y sin el fichero", async () => {
    const res = await LIST(
      makeRequest(`/api/projects/${proyectoId}/document-templates`, { cookie: sessionCookie(a.user) }),
      listCtx(proyectoId)
    );
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.projectRole).toBe("adjudicatario");
    const listados = data.templates.map((t: { id: string }) => t.id);
    expect(listados).toEqual(expect.arrayContaining([ids.acta, ids.matriz, ids.sinBinario]));
    expect(listados).not.toContain(ids.otroRol);
    expect(listados).not.toContain(ids.retirada);
    // El nombre por defecto del helper incluye el fichero: se comprueba la clave, no el texto.
    expect(data.templates.some((t: object) => "fichero" in t)).toBe(false);
  });

  it("404 a otro usuario; 200 a un admin", async () => {
    const ajeno = await LIST(
      makeRequest(`/api/projects/${proyectoId}/document-templates`, { cookie: sessionCookie(b.user) }),
      listCtx(proyectoId)
    );
    expect(ajeno.status).toBe(404);
    expect(await ajeno.json()).toEqual({ error: "Proyecto no encontrado." });

    const admin = await LIST(
      makeRequest(`/api/projects/${proyectoId}/document-templates`, { cookie: sessionCookie(b.admin) }),
      listCtx(proyectoId)
    );
    expect(admin.status).toBe(200);
  });
});

describe("GET /api/projects/[id]/document-templates/[templateId]/file", () => {
  it("401 sin sesion", async () => {
    const res = await FILE(makeRequest(urlFichero(proyectoId, ids.acta)), fileCtx(proyectoId, ids.acta));
    expect(res.status).toBe(401);
  });

  it("200 con el binario y las cabeceras del contrato", async () => {
    const res = await FILE(
      makeRequest(urlFichero(proyectoId, ids.acta), { cookie: sessionCookie(a.user) }),
      fileCtx(proyectoId, ids.acta)
    );
    expect(res.status).toBe(200);
    const contenido = `SYNTHETIC TEST DATA ${ACTA}`;
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(res.headers.get("Content-Disposition")).toContain("attachment; filename=\"SYNTHETIC-api-Acta Aprobacion.docx\"");
    expect(res.headers.get("Content-Length")).toBe(String(Buffer.byteLength(contenido)));
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await res.text()).toBe(contenido);
  });

  it("xlsx lleva su Content-Type", async () => {
    const res = await FILE(
      makeRequest(urlFichero(proyectoId, ids.matriz), { cookie: sessionCookie(a.user) }),
      fileCtx(proyectoId, ids.matriz)
    );
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });

  it("404 identico para ajeno, otro rol, retirada e inexistente", async () => {
    const casos: [string, string, string][] = [
      [sessionCookie(b.user), proyectoId, ids.acta],
      [sessionCookie(a.user), proyectoId, ids.otroRol],
      [sessionCookie(a.user), proyectoId, ids.retirada],
      [sessionCookie(a.user), proyectoId, "no-existe"],
      [sessionCookie(a.user), "proyecto-inexistente", ids.acta],
    ];
    for (const [cookie, id, templateId] of casos) {
      const res = await FILE(makeRequest(urlFichero(id, templateId), { cookie }), fileCtx(id, templateId));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Plantilla no encontrada." });
    }
  });

  it("500 si el binario no esta desplegado", async () => {
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await FILE(
      makeRequest(urlFichero(proyectoId, ids.sinBinario), { cookie: sessionCookie(a.user) }),
      fileCtx(proyectoId, ids.sinBinario)
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "No se pudo descargar la plantilla." });
    expect(espia.mock.calls[0][0]).toBe("plantilla en catalogo sin binario desplegado");
    espia.mockRestore();
  });
});
