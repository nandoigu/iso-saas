/**
 * Cuenta las paginas de un PDF leyendo el arbol de paginas del propio fichero.
 * Sin dependencias: busca /Count en el nodo raiz /Type /Pages y, como respaldo,
 * cuenta los objetos /Type /Page. Solo lectura.
 *
 *   node scripts/paginas-pdf.mjs "docs/muestras/mi.pdf"
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ruta = process.argv[2];
if (!ruta) {
  console.error("Uso: node scripts/paginas-pdf.mjs <ruta.pdf>");
  process.exit(1);
}

const buf = readFileSync(ruta);
const texto = buf.toString("latin1");

// Los objetos /Type /Page (sin la s final) son las paginas reales.
const porObjeto = (texto.match(/\/Type\s*\/Page[^s]/g) ?? []).length;

// El nodo raiz del arbol declara /Count con el total. Puede haber nodos
// intermedios, asi que nos quedamos con el mayor.
const cuentas = [...texto.matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
const porArbol = cuentas.length ? Math.max(...cuentas) : 0;

const paginas = porArbol || porObjeto;
const mb = buf.length / 1024 / 1024;

console.log(`${path.basename(ruta)}`);
console.log(`  tamaño:            ${mb.toFixed(2)} MB`);
console.log(`  paginas (/Count):  ${porArbol || "n/d"}`);
console.log(`  paginas (objetos): ${porObjeto}`);
console.log(`  -> se usa:         ${paginas}`);
if (porArbol && porObjeto && porArbol !== porObjeto) {
  console.log("  aviso: los dos metodos no coinciden; el PDF puede estar comprimido por objetos");
}
