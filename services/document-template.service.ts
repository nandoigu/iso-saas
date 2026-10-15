import { readdir, stat } from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { getPlantillasDir } from "@/services/document-template.paths";
import {
  FASES_ORDEN,
  PROJECT_ROLES,
  type DocumentTemplateActor,
  type DocumentTemplateImportSummary,
  type ParsedDocumentTemplateRow,
  type ProjectDocumentTemplate,
} from "@/services/document-template.types";

// Catalogo documental (ADR-016). Ninguna funcion de este modulo borra una
// DocumentTemplate: retirar es vigente = false (invariante 1 del domain model).

type Deseado = {
  fichero: string;
  nombre: string;
  formato: string;
  vigente: boolean;
  roles: string[];
  fase: string;
  obligatoria: boolean;
  tipo: string;
  requirementTemplateIds: string[];
};

type ImportOptions = {
  dir?: string;
  // Solo para tests: limita la retirada a las plantillas con este prefijo, para no
  // tocar el catalogo real de la rama Test. En produccion el ambito es todo el catalogo.
  ficheroPrefix?: string;
};

// La importacion de 23 filas son ~100 consultas: el limite por defecto de 5 s de las
// transacciones interactivas se queda corto contra Neon.
const IMPORT_TRANSACTION = { timeout: 60_000, maxWait: 10_000 } as const;

export async function importDocumentTemplates(
  rows: ParsedDocumentTemplateRow[],
  actorId: string,
  options: ImportOptions = {}
): Promise<
  { ok: true; summary: DocumentTemplateImportSummary } | { ok: false; errors: string[] }
> {
  const dir = options.dir ?? getPlantillasDir();
  const errors: string[] = [];

  // Se compara en NFC y se guarda el nombre real en disco: las tildes pueden venir
  // compuestas de forma distinta en el Excel y en el sistema de ficheros.
  const enDisco = new Map((await readdir(dir)).map((n) => [n.normalize("NFC"), n]));

  const catalogo = await prisma.requirementTemplate.findMany({
    where: { role: { in: [...PROJECT_ROLES] } },
    select: { id: true, norma: true, item: true, role: true },
  });

  const deseados: Deseado[] = [];
  for (const row of rows) {
    const real = enDisco.get(row.fichero.normalize("NFC"));
    if (!real) {
      errors.push(`Fila ${row.fila}: el fichero «${row.fichero}» no está en docs/fuentes/plantillas-iso/.`);
    }

    const ids = new Set<string>();
    for (const ref of row.referencias) {
      const encontrados = catalogo.filter(
        (r) =>
          r.norma === ref.norma &&
          r.item === ref.item &&
          (row.roles as readonly string[]).includes(r.role)
      );
      if (encontrados.length === 0) {
        errors.push(
          `Fila ${row.fila}: el requisito ${ref.norma}/${ref.item} no existe para ningún rol de la fila (${row.roles.join(", ")}).`
        );
      }
      for (const r of encontrados) ids.add(r.id);
    }

    deseados.push({
      fichero: real ?? row.fichero,
      nombre: row.nombre,
      formato: row.formato,
      vigente: row.vigente,
      roles: [...row.roles],
      fase: row.fase,
      obligatoria: row.obligatoria,
      tipo: row.tipo,
      requirementTemplateIds: [...ids].sort(),
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  const summary = await prisma.$transaction(
    (tx) => escribirCatalogo(tx, deseados, actorId, options.ficheroPrefix ?? ""),
    IMPORT_TRANSACTION
  );
  return { ok: true, summary };
}

async function escribirCatalogo(
  tx: Prisma.TransactionClient,
  deseados: Deseado[],
  actorId: string,
  ficheroPrefix: string
): Promise<DocumentTemplateImportSummary> {
  const existentes = await tx.documentTemplate.findMany({
    where: { fichero: { startsWith: ficheroPrefix } },
    include: { requirementLinks: { select: { requirementTemplateId: true } } },
  });
  const porFichero = new Map(existentes.map((t) => [t.fichero, t]));
  const resumen: DocumentTemplateImportSummary = {
    total: deseados.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    retired: 0,
    links: 0,
  };

  for (const d of deseados) {
    resumen.links += d.requirementTemplateIds.length;
    const actual = porFichero.get(d.fichero);
    const vinculos = {
      create: d.requirementTemplateIds.map((requirementTemplateId) => ({ requirementTemplateId })),
    };

    if (!actual) {
      const creada = await tx.documentTemplate.create({
        data: { ...campos(d), version: 1, createdBy: actorId, requirementLinks: vinculos },
      });
      await tx.documentTemplateVersion.create({
        data: { documentTemplateId: creada.id, version: 1, snapshot: snapshot(d), importedBy: actorId },
      });
      resumen.created += 1;
      continue;
    }

    const vinculadosAhora = actual.requirementLinks.map((l) => l.requirementTemplateId).sort();
    if (mismoEstado({ ...actual, requirementTemplateIds: vinculadosAhora }, d)) {
      resumen.unchanged += 1;
      continue;
    }

    const version = actual.version + 1;
    await tx.documentTemplateRequirement.deleteMany({ where: { documentTemplateId: actual.id } });
    await tx.documentTemplate.update({
      where: { id: actual.id },
      data: { ...campos(d), version, updatedBy: actorId, requirementLinks: vinculos },
    });
    await tx.documentTemplateVersion.create({
      data: { documentTemplateId: actual.id, version, snapshot: snapshot(d), importedBy: actorId },
    });
    resumen.updated += 1;
  }

  const enLibro = new Set(deseados.map((d) => d.fichero));
  for (const t of existentes) {
    if (enLibro.has(t.fichero) || !t.vigente) continue;
    const version = t.version + 1;
    const retirada: Deseado = {
      ...campos(t),
      fichero: t.fichero,
      vigente: false,
      requirementTemplateIds: t.requirementLinks.map((l) => l.requirementTemplateId).sort(),
    };
    await tx.documentTemplate.update({
      where: { id: t.id },
      data: { vigente: false, version, updatedBy: actorId },
    });
    await tx.documentTemplateVersion.create({
      data: { documentTemplateId: t.id, version, snapshot: snapshot(retirada), importedBy: actorId },
    });
    resumen.retired += 1;
  }

  return resumen;
}

function campos(d: Omit<Deseado, "requirementTemplateIds">) {
  return {
    fichero: d.fichero,
    nombre: d.nombre,
    formato: d.formato,
    vigente: d.vigente,
    roles: d.roles,
    fase: d.fase,
    obligatoria: d.obligatoria,
    tipo: d.tipo,
  };
}

function snapshot(d: Deseado): Prisma.InputJsonObject {
  return { ...campos(d), requirementTemplateIds: d.requirementTemplateIds };
}

function mismoEstado(a: Deseado, b: Deseado) {
  return (
    a.nombre === b.nombre &&
    a.formato === b.formato &&
    a.vigente === b.vigente &&
    a.fase === b.fase &&
    a.obligatoria === b.obligatoria &&
    a.tipo === b.tipo &&
    mismaLista(a.roles, b.roles) &&
    mismaLista(a.requirementTemplateIds, b.requirementTemplateIds)
  );
}

function mismaLista(a: string[], b: string[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// Mismo criterio que findProjectForActor de evidence.service.ts (dueno o admin), pero
// necesita el rol del proyecto.
async function findProjectForActor(projectId: string, actor: DocumentTemplateActor) {
  return prisma.project.findFirst({
    where: { id: projectId, ...(actor.isAdmin ? {} : { userId: actor.userId }) },
    select: { id: true, role: true },
  });
}

// Invariante 8: aplicable = vigente y Project.role en roles.
const aplicableA = (role: string) => ({ vigente: true, roles: { has: role } });

export async function listApplicableTemplates(
  projectId: string,
  actor: DocumentTemplateActor
): Promise<{ notFound: true } | { projectRole: string; templates: ProjectDocumentTemplate[] }> {
  const project = await findProjectForActor(projectId, actor);
  if (!project) return { notFound: true };

  const templates = await prisma.documentTemplate.findMany({
    where: aplicableA(project.role),
    select: { id: true, nombre: true, formato: true, fase: true, obligatoria: true, tipo: true },
  });

  const indiceFase = (fase: string) => {
    const i = (FASES_ORDEN as readonly string[]).indexOf(fase);
    return i === -1 ? FASES_ORDEN.length : i;
  };
  templates.sort(
    (a, b) => indiceFase(a.fase) - indiceFase(b.fase) || a.nombre.localeCompare(b.nombre, "es")
  );

  return { projectRole: project.role, templates };
}

export async function resolveTemplateFile(
  projectId: string,
  templateId: string,
  actor: DocumentTemplateActor,
  dir: string = getPlantillasDir()
): Promise<
  | { notFound: true }
  | { missing: true; fichero: string }
  | { ruta: string; fichero: string; formato: string; size: number }
> {
  // Primero el proyecto: una plantilla valida no confirma que exista un proyecto ajeno.
  const project = await findProjectForActor(projectId, actor);
  if (!project) return { notFound: true };

  const plantilla = await prisma.documentTemplate.findFirst({
    where: { id: templateId, ...aplicableA(project.role) },
    select: { fichero: true, formato: true },
  });
  if (!plantilla) return { notFound: true };

  // Segundo cierre del recorrido de rutas (el primero es el parser).
  const base = path.resolve(dir);
  const ruta = path.resolve(base, plantilla.fichero);
  if (!ruta.startsWith(base + path.sep)) {
    console.error("plantilla con fichero fuera del directorio de plantillas", { templateId });
    return { notFound: true };
  }

  try {
    const info = await stat(ruta);
    if (!info.isFile()) return { missing: true, fichero: plantilla.fichero };
    return { ruta, fichero: plantilla.fichero, formato: plantilla.formato, size: info.size };
  } catch {
    return { missing: true, fichero: plantilla.fichero };
  }
}
