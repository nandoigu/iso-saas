/**
 * Mide cuantos tokens de entrada cuesta analizar un PDF con la API de Anthropic.
 * Es la medicion que ADR-008 dejaba fijada y nunca se habia ejecutado: sin ella
 * cualquier decision sobre el troceado de peticiones es a ojo.
 *
 * Usa messages.count_tokens, que NO consume tokens de modelo y no tiene coste.
 * No escribe nada ni en disco ni en la base de datos.
 *
 *   node scripts/medir-tokens-pdf.mjs "docs/muestras/mi.pdf"
 *
 * La clave se lee de .env.local (ANTHROPIC_API_KEY). Nunca se imprime.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const MODELO = "claude-opus-5";
const PRECIO_ENTRADA_POR_MILLON = 5; // USD, claude-opus-5
const REQUISITOS_POR_ROL = { adjudicador: 38, adjudicatario_principal: 35, adjudicatario: 18 };

// --- clave -----------------------------------------------------------------
function cargarClave() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  let raw;
  try {
    raw = readFileSync(".env.local", "utf8");
  } catch {
    return null;
  }
  const nombres = [];
  let comentadas = 0;
  for (const linea of raw.split(/\r?\n/)) {
    const t = linea.trim();
    if (t.startsWith("#") && /ANTHROPIC/i.test(t)) comentadas += 1;
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const nombre = t.slice(0, t.indexOf("=")).trim();
    nombres.push(nombre);
    if (nombre === "ANTHROPIC_API_KEY") {
      return t.slice(t.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  // Solo los NOMBRES de variable, nunca los valores.
  console.error("No hay una variable ANTHROPIC_API_KEY activa en .env.local.");
  const relacionadas = nombres.filter((n) => /ANTHROPIC|CLAUDE|API/i.test(n));
  console.error(`  Variables activas relacionadas: ${relacionadas.join(", ") || "ninguna"}`);
  console.error(`  Lineas COMENTADAS que mencionan ANTHROPIC: ${comentadas}`);
  console.error(`  Total de variables activas en el fichero: ${nombres.length}`);
  return null;
}

const apiKey = cargarClave();
if (!apiKey) process.exit(1);

// --- pdf -------------------------------------------------------------------
const ruta = process.argv[2] ?? "docs/muestras/Plantilla-Manual BIM-V01.pdf";
const bytes = readFileSync(ruta);
const mb = bytes.length / 1024 / 1024;
console.log(`Documento: ${path.basename(ruta)}  (${mb.toFixed(2)} MB)`);
if (mb > 32) {
  console.error("ABORTADO: la API acepta 32 MB por peticion como maximo.");
  process.exit(1);
}
const datosPdf = bytes.toString("base64");

const client = new Anthropic({ apiKey });

// El bloque `document` va ANTES del bloque de texto.
const bloquePdf = {
  type: "document",
  source: { type: "base64", media_type: "application/pdf", data: datosPdf },
};

const SISTEMA =
  "Eres un auditor ISO 19650. Evaluas la documentacion aportada frente a un requisito " +
  "concreto y emites un hallazgo con su cita literal.";

const REQUISITO_EJEMPLO =
  "Requisito 19650-2 5.1.7 - Establecer el entorno comun de datos (CDE) del proyecto. " +
  "¿Establece, implementa, configura y apoya un CDE del proyecto bien de forma directa o " +
  "a traves de un tercero? ¿Asigna a cada CI un identificador unico basado en un convenio " +
  "acordado y documentado compuesto por campos separados por un delimitador?";

async function contar(etiqueta, params) {
  const r = await client.messages.countTokens({ model: MODELO, ...params });
  console.log(`  ${etiqueta.padEnd(46)} ${String(r.input_tokens).padStart(8)} tokens`);
  return r.input_tokens;
}

console.log(`\nModelo: ${MODELO}\n`);

const soloPdf = await contar("PDF solo", {
  messages: [{ role: "user", content: [bloquePdf, { type: "text", text: "." }] }],
});

const unaPeticion = await contar("Peticion completa (PDF + sistema + 1 requisito)", {
  system: SISTEMA,
  messages: [{ role: "user", content: [bloquePdf, { type: "text", text: REQUISITO_EJEMPLO }] }],
});

const sinPdf = await contar("Sistema + 1 requisito, SIN el PDF", {
  system: SISTEMA,
  messages: [{ role: "user", content: [{ type: "text", text: REQUISITO_EJEMPLO }] }],
});

const coste = (t) => (t / 1_000_000) * PRECIO_ENTRADA_POR_MILLON;

console.log(`\nEl PDF pesa ${soloPdf.toLocaleString("es")} tokens; el enunciado de un requisito, ${sinPdf.toLocaleString("es")}.`);
console.log(`Reenviar el PDF cuesta ${(soloPdf / sinPdf).toFixed(0)}x lo que cuesta la pregunta.\n`);

console.log("Coste de ENTRADA por auditoria, sin descuento de lote\n");
console.log("  rol                        reqs   una peticion por requisito      todo en una");
for (const [rol, n] of Object.entries(REQUISITOS_POR_ROL)) {
  const troceado = unaPeticion * n;
  const agrupado = soloPdf + (unaPeticion - soloPdf) * n;
  console.log(
    `  ${rol.padEnd(24)} ${String(n).padStart(4)}   ` +
      `${troceado.toLocaleString("es").padStart(10)} tok  $${coste(troceado).toFixed(2).padStart(6)}   ` +
      `${agrupado.toLocaleString("es").padStart(10)} tok  $${coste(agrupado).toFixed(2)}`
  );
}

const peor = REQUISITOS_POR_ROL.adjudicador;
const ahorro = 1 - (soloPdf + (unaPeticion - soloPdf) * peor) / (unaPeticion * peor);
console.log(`\nAgrupar los ${peor} requisitos del adjudicador en una sola peticion ahorra el ${(ahorro * 100).toFixed(1)}% de la entrada.`);
console.log("Con Batches (-50%) las dos columnas se quedan a la mitad. La salida se paga aparte.");
