// Genera el libro de trabajo del catalogo de plantillas documentales.
//
// No inventa contenido: lista los ficheros de docs/fuentes/plantillas-iso/ y deja
// vacias las columnas que decide el experto (vigencia, rol, fase, obligatoriedad,
// tipo y requisitos que justifica). Ese mapeo es contenido de auditoria y no puede
// deducirse (regla de integridad normativa de CLAUDE.md).
//
// La hoja "Requisitos" es solo de consulta: copia norma, item, titulo y rol de los
// Excel de requisitos usando el parser real del importador, para que el experto
// escriba referencias que el importador del catalogo pueda resolver.
//
// Uso: node scripts/preparar-excel-plantillas-documentales.mjs
import { readdir, readFile, mkdir, writeFile, access } from "node:fs/promises";
import { extname, join } from "node:path";
import ExcelJS from "exceljs";
import { parseRoleTemplateRequirementWorkbook } from "../app/lib/requirementImport.ts";

const ORIGEN = "docs/fuentes";
const PLANTILLAS = join(ORIGEN, "plantillas-iso");
const DESTINO = join(ORIGEN, "trabajo", "plantillas_documentales.xlsx");

const LIBROS_REQUISITOS = [
  { nombre: "requerimientos_adjudicador.xlsx", rol: "adjudicador" },
  { nombre: "requerimientos_adjudicatario principal.xlsx", rol: "adjudicatario_principal" },
  { nombre: "requerimientos_adjudicatario.xlsx", rol: "adjudicatario" },
];

// Columnas que escribe el experto. Si alguna tiene contenido, el libro no se pisa.
const COLUMNAS_DEL_EXPERTO = [4, 5, 6, 7, 8, 9, 10];

async function tieneTrabajoEscrito(ruta) {
  try {
    await access(ruta);
  } catch {
    return false;
  }

  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(ruta);
  const hoja = libro.getWorksheet("Plantillas");
  if (!hoja) return false;

  let escritas = 0;
  hoja.eachRow((fila, numero) => {
    if (numero === 1) return;
    for (const columna of COLUMNAS_DEL_EXPERTO) {
      const valor = fila.getCell(columna).value;
      if (valor != null && String(valor).trim() !== "") escritas += 1;
    }
  });

  return escritas > 0;
}

// Nombre de partida a partir del fichero, solo para orientar: el experto lo corrige.
function nombrePropuesto(fichero) {
  return fichero
    .slice(0, -extname(fichero).length)
    .replace(/^plantilla[\s_-]*/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lista(valores) {
  return { type: "list", allowBlank: true, formulae: [`"${valores.join(",")}"`] };
}

if (await tieneTrabajoEscrito(DESTINO)) {
  console.log("plantillas_documentales.xlsx: RESPETADO, ya tiene trabajo escrito");
  process.exit(0);
}

const ficheros = (await readdir(PLANTILLAS))
  .filter((f) => [".docx", ".xlsx"].includes(extname(f).toLowerCase()))
  .sort((a, b) => a.localeCompare(b, "es"));

const libro = new ExcelJS.Workbook();
const hoja = libro.addWorksheet("Plantillas");

hoja.columns = [
  { header: "Fichero", key: "fichero", width: 48 },
  { header: "Formato", key: "formato", width: 9 },
  { header: "Nombre (corregir)", key: "nombre", width: 40 },
  { header: "Vigente", key: "vigente", width: 9 },
  { header: "Rol (uno o varios, separados por coma)", key: "rol", width: 30 },
  { header: "Fase", key: "fase", width: 15 },
  { header: "Obligatoria", key: "obligatoria", width: 11 },
  { header: "Tipo", key: "tipo", width: 15 },
  { header: "Requisitos que justifica (norma / item; separados por punto y coma)", key: "requisitos", width: 45 },
  { header: "Observaciones", key: "observaciones", width: 40 },
];

for (const fichero of ficheros) {
  const fila = hoja.addRow({
    fichero,
    formato: extname(fichero).slice(1).toLowerCase(),
    nombre: nombrePropuesto(fichero),
  });
  fila.alignment = { vertical: "top", wrapText: true };
  fila.getCell("vigente").dataValidation = lista(["sí", "no"]);
  fila.getCell("fase").dataValidation = lista([
    "oferta",
    "contratación",
    "movilización",
    "producción",
    "entrega",
    "cierre",
  ]);
  fila.getCell("obligatoria").dataValidation = lista(["sí", "no"]);
  fila.getCell("tipo").dataValidation = lista(["iso", "administrativa", "ambas"]);
}

hoja.getRow(1).font = { bold: true };
hoja.getRow(1).alignment = { vertical: "middle", wrapText: true };
hoja.views = [{ state: "frozen", ySplit: 1, xSplit: 1 }];

// Hoja de consulta con los requisitos que el importador sabe resolver.
const consulta = libro.addWorksheet("Requisitos (consulta)");
consulta.columns = [
  { header: "Rol", width: 24 },
  { header: "Norma", width: 12 },
  { header: "Item", width: 10 },
  { header: "Referencia a copiar", width: 22 },
  { header: "Título del Requerimiento", width: 60 },
];

let totalRequisitos = 0;
for (const { nombre, rol } of LIBROS_REQUISITOS) {
  const buffer = await readFile(join(ORIGEN, nombre));
  const resultado = await parseRoleTemplateRequirementWorkbook(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  );
  if (resultado.errors.length > 0) {
    console.error(`${nombre}: el parser devuelve errores, PARAR`);
    for (const error of resultado.errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  for (const r of resultado.rows) {
    consulta.addRow([rol, r.norma, r.item, `${r.norma} / ${r.item}`, r.titulo]);
    totalRequisitos += 1;
  }
}
consulta.getRow(1).font = { bold: true };
consulta.views = [{ state: "frozen", ySplit: 1 }];

await mkdir(join(ORIGEN, "trabajo"), { recursive: true });
await writeFile(DESTINO, await libro.xlsx.writeBuffer());

console.log(`plantillas_documentales.xlsx: ${ficheros.length} plantillas, ${totalRequisitos} requisitos de consulta`);
if (totalRequisitos !== 91) {
  console.error(`PARAR: se esperaban 91 requisitos de consulta (verificado el 11-ago).`);
  process.exitCode = 1;
}
