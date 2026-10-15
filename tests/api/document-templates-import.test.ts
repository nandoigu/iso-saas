import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import ExcelJS from "exceljs";
import { prisma } from "@/app/lib/prisma";
import { POST as IMPORT_CATALOGO } from "@/app/api/admin/document-templates/import/route";
import { POST as IMPORT_REQUISITOS } from "@/app/api/import/route";
import { BLOCKED_ACCOUNT_MESSAGE } from "@/app/lib/auth";
import { cleanupTenant, createTenant } from "../helpers/db";
import { sessionCookie } from "../helpers/auth";
import { SYNTHETIC_PREFIX, cleanupSyntheticDocumentTemplates } from "../helpers/document-templates";

let t: Awaited<ReturnType<typeof createTenant>>;

async function libro(nombreHoja: string, filas: string[][]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(nombreHoja);
  for (const fila of filas) sheet.addRow(fila);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function peticion(url: string, cookie: string | null, fichero?: { contenido: Buffer; nombre: string }, extra: Record<string, string> = {}) {
  const datos = new FormData();
  if (fichero) datos.append("file", new File([fichero.contenido], fichero.nombre));
  for (const [k, v] of Object.entries(extra)) datos.append(k, v);
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: cookie ? { Cookie: cookie } : {},
    body: datos,
  });
}

const URL_CATALOGO = "/api/admin/document-templates/import";

beforeAll(async () => {
  t = await createTenant("doc-templates-import");
  await cleanupSyntheticDocumentTemplates();
});

afterAll(async () => {
  await cleanupSyntheticDocumentTemplates();
  await cleanupTenant(t.company.id);
});

describe("POST /api/admin/document-templates/import", () => {
  it("401 sin sesion", async () => {
    expect((await IMPORT_CATALOGO(peticion(URL_CATALOGO, null))).status).toBe(401);
  });

  it("403 a un usuario no admin", async () => {
    expect((await IMPORT_CATALOGO(peticion(URL_CATALOGO, sessionCookie(t.user)))).status).toBe(403);
  });

  it("403 con el mensaje de cuenta bloqueada", async () => {
    await prisma.user.update({ where: { id: t.admin.id }, data: { status: "blocked" } });
    try {
      const res = await IMPORT_CATALOGO(peticion(URL_CATALOGO, sessionCookie(t.admin)));
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: BLOCKED_ACCOUNT_MESSAGE });
    } finally {
      await prisma.user.update({ where: { id: t.admin.id }, data: { status: "active" } });
    }
  });

  it("400 sin fichero y con un fichero que no es xlsx", async () => {
    expect((await IMPORT_CATALOGO(peticion(URL_CATALOGO, sessionCookie(t.admin)))).status).toBe(400);
    const res = await IMPORT_CATALOGO(
      peticion(URL_CATALOGO, sessionCookie(t.admin), { contenido: Buffer.from("hola"), nombre: "libro.csv" })
    );
    expect(res.status).toBe(400);
  });

  it("400 con los errores por fila y sin escribir nada", async () => {
    // SYNTHETIC TEST DATA: el fichero no existe en docs/fuentes/plantillas-iso/.
    const contenido = await libro("Plantillas", [
      ["Fichero", "Formato", "Nombre", "Vigente", "Rol", "Fase", "Obligatoria", "Tipo", "Requisitos que justifica"],
      ["SYNTHETIC-import-no-existe.docx", "docx", "SYNTHETIC TEST DATA", "sí", "adjudicador", "oferta", "sí", "iso", ""],
    ]);
    const res = await IMPORT_CATALOGO(
      peticion(URL_CATALOGO, sessionCookie(t.admin), { contenido, nombre: "plantillas_documentales.xlsx" })
    );
    expect(res.status).toBe(400);
    const cuerpo = await res.json();
    expect(cuerpo.error).toBe("El libro tiene errores.");
    expect(cuerpo.details).toEqual([
      "Fila 2: el fichero «SYNTHETIC-import-no-existe.docx» no está en docs/fuentes/plantillas-iso/.",
    ]);
    expect(await prisma.documentTemplate.count({ where: { fichero: { startsWith: SYNTHETIC_PREFIX } } })).toBe(0);
  });
});

describe("POST /api/import con replace=true", () => {
  // No se borra el catalogo real de Test: se simula el P2003 que la FK Restrict
  // provoca de verdad (lo prueba tests/services/document-template.service.test.ts).
  async function libroRequisitos() {
    return libro("Hoja1", [
      ["norma", "item", "requerimiento", "evidencia", "estado", "fecha_limite"],
      ["SYNTHETIC-19650-9", "1.1", "SYNTHETIC TEST DATA", "", "total", ""],
    ]);
  }

  it("409 si hay plantillas documentales vinculadas, sin crear nada", async () => {
    const borrar = vi
      .spyOn(prisma.requirementTemplate, "deleteMany")
      .mockRejectedValueOnce(Object.assign(new Error("FK"), { code: "P2003" }));
    const crear = vi.spyOn(prisma.requirementTemplate, "createMany");
    try {
      const res = await IMPORT_REQUISITOS(
        peticion("/api/import", sessionCookie(t.admin), { contenido: await libroRequisitos(), nombre: "req.xlsx" }, { replace: "true" })
      );
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({
        error:
          "No se puede reemplazar el catálogo de requisitos: hay plantillas documentales que justifican algunos de ellos.",
      });
      expect(crear).not.toHaveBeenCalled();
    } finally {
      borrar.mockRestore();
      crear.mockRestore();
    }
  });

  it("otro error sigue siendo 500", async () => {
    const borrar = vi
      .spyOn(prisma.requirementTemplate, "deleteMany")
      .mockRejectedValueOnce(new Error("caida"));
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await IMPORT_REQUISITOS(
        peticion("/api/import", sessionCookie(t.admin), { contenido: await libroRequisitos(), nombre: "req.xlsx" }, { replace: "true" })
      );
      expect(res.status).toBe(500);
    } finally {
      borrar.mockRestore();
      espia.mockRestore();
    }
  });
});
