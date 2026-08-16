/**
 * Sonda de la Fase D del Evidence Graph: comprueba contra el store REAL que las
 * dos piezas que faltaban funcionan como promete el api-contract.
 *
 *   1. Un blob privado NO es accesible por su URL sin firmar (ADR-003 #1).
 *   2. `issueSignedToken` + `presignUrl` producen una signed URL que SI sirve el
 *      contenido, y que caduca.
 *   3. Si un cliente con token de subida puede escalar a `access: 'public'`.
 *      Es la pregunta que decide como se implementa `upload-token`: en el
 *      handshake clasico el `access` lo elige el cliente, no el servidor.
 *
 * Escribe y BORRA sus propios ficheros bajo `_sonda/`. No toca la base de datos.
 *
 *   node scripts/probar-blob-fase-d.mjs
 *
 * El token se lee de .env.local (BLOB_READ_WRITE_TOKEN). Nunca se imprime.
 */
import { readFileSync } from "node:fs";
import {
  put,
  del,
  head,
  issueSignedToken,
  presignUrl,
} from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";

function cargarToken() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  let raw;
  try {
    raw = readFileSync(".env.local", "utf8");
  } catch {
    return null;
  }
  for (const linea of raw.split(/\r?\n/)) {
    const t = linea.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const nombre = t.slice(0, t.indexOf("=")).trim();
    if (nombre === "BLOB_READ_WRITE_TOKEN") {
      return t.slice(t.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return null;
}

const token = cargarToken();
if (!token) {
  console.error("FALTA BLOB_READ_WRITE_TOKEN en el entorno o en .env.local");
  process.exit(1);
}

const marca = Date.now();
const CONTENIDO = `SYNTHETIC TEST DATA - sonda Fase D ${marca}`;
const creados = [];

function resultado(ok, etiqueta, detalle = "") {
  console.log(`${ok ? "OK  " : "FALLO"}  ${etiqueta}${detalle ? " -> " + detalle : ""}`);
  return ok;
}

async function main() {
  const fallos = [];

  // --- 1. subida privada del lado servidor ---------------------------------
  const privado = await put(`_sonda/${marca}/privado.txt`, CONTENIDO, {
    access: "private",
    token,
    addRandomSuffix: false,
  });
  creados.push(privado.url);
  console.log(`\npathname creado: ${privado.pathname}`);

  const meta = await head(privado.url, { token });
  console.log(`head -> contentType=${meta.contentType} size=${meta.size}`);

  // --- 2. la URL desnuda no debe servir el contenido ------------------------
  const desnuda = await fetch(privado.url);
  if (
    !resultado(
      desnuda.status !== 200,
      "URL privada sin firmar rechazada",
      `HTTP ${desnuda.status}`
    )
  ) {
    fallos.push("un blob privado se sirvio por su URL desnuda");
  }

  // --- 3. signed URL: emision, uso y caducidad ------------------------------
  const delegacion = await issueSignedToken({
    pathname: privado.pathname,
    operations: ["get"],
    validUntil: Date.now() + 5 * 60 * 1000,
    token,
  });

  const { presignedUrl } = await presignUrl(delegacion, {
    operation: "get",
    pathname: privado.pathname,
    access: "private",
    validUntil: Date.now() + 5 * 60 * 1000,
  });

  const firmada = await fetch(presignedUrl);
  const cuerpo = firmada.ok ? await firmada.text() : "";
  if (
    !resultado(
      firmada.status === 200 && cuerpo === CONTENIDO,
      "signed URL sirve el contenido correcto",
      `HTTP ${firmada.status}`
    )
  ) {
    fallos.push("la signed URL no devolvio el contenido esperado");
  }

  // Caducidad real: se firma con 3 s de vida y se consulta pasados 8 s. El SDK
  // rechaza firmar una URL ya vencida, asi que hay que esperar de verdad.
  const { presignedUrl: efimera } = await presignUrl(delegacion, {
    operation: "get",
    pathname: privado.pathname,
    access: "private",
    validUntil: Date.now() + 3000,
  });
  await new Promise((r) => setTimeout(r, 8000));
  const respCaducada = await fetch(efimera);
  if (
    !resultado(
      respCaducada.status !== 200,
      "signed URL caducada rechazada",
      `HTTP ${respCaducada.status}`
    )
  ) {
    fallos.push("una signed URL caducada siguio sirviendo el contenido");
  }

  // --- 4. escalada de privilegio: cliente pide 'public' --------------------
  // Reproduce el handshake clasico: el servidor firma un token acotado a un
  // pathname y el cliente decide el `access` en su llamada a `put`.
  const rutaEscalada = `_sonda/${marca}/escalada.txt`;
  const tokenCliente = await generateClientTokenFromReadWriteToken({
    pathname: rutaEscalada,
    token,
    validUntil: Date.now() + 5 * 60 * 1000,
    addRandomSuffix: false,
  });

  let escalado = null;
  let errorEscalada = null;
  try {
    escalado = await put(rutaEscalada, CONTENIDO, {
      access: "public",
      token: tokenCliente,
      addRandomSuffix: false,
    });
    creados.push(escalado.url);
  } catch (error) {
    errorEscalada = error;
  }

  if (escalado) {
    const publica = await fetch(escalado.url);
    const esPublico = publica.status === 200;
    resultado(
      !esPublico,
      "cliente NO puede publicar la evidencia",
      `subida aceptada, URL desnuda HTTP ${publica.status}`
    );
    if (esPublico) {
      fallos.push(
        "ESCALADA CONFIRMADA: con el handshake clasico el cliente sube como publico"
      );
    }
  } else {
    resultado(
      true,
      "cliente NO puede publicar la evidencia",
      `rechazado: ${errorEscalada?.name}: ${errorEscalada?.message}`
    );
  }

  // --- 5. el token de subida esta acotado al pathname ----------------------
  // Reproduce lo que emite `handleEvidenceUploadToken` con las mismas
  // restricciones. Comprueba que el prefijo por proyecto no depende solo de
  // nuestra comprobacion en `onBeforeGenerateToken`: el propio token lo impone.
  const proyectoFalso = `p-${marca}`;
  const rutaAutorizada = `evidence/${proyectoFalso}/plano.txt`;
  const tokenSubida = await generateClientTokenFromReadWriteToken({
    pathname: rutaAutorizada,
    token,
    validUntil: Date.now() + 5 * 60 * 1000,
    maximumSizeInBytes: 200 * 1024 * 1024,
    addRandomSuffix: true,
  });

  const subido = await put(rutaAutorizada, CONTENIDO, {
    access: "private",
    token: tokenSubida,
    addRandomSuffix: true,
  });
  creados.push(subido.url);
  if (
    !resultado(
      subido.pathname.startsWith(`evidence/${proyectoFalso}/`),
      "subida con token de cliente cae bajo el prefijo del proyecto",
      subido.pathname
    )
  ) {
    fallos.push("el sufijo aleatorio saco el archivo del prefijo del proyecto");
  }

  let fuera = null;
  let errorFuera = null;
  try {
    fuera = await put(`evidence/otro-proyecto/robado.txt`, CONTENIDO, {
      access: "private",
      token: tokenSubida,
      addRandomSuffix: false,
    });
    creados.push(fuera.url);
  } catch (error) {
    errorFuera = error;
  }
  if (
    !resultado(
      fuera === null,
      "el token rechaza un pathname de otro proyecto",
      errorFuera ? `${errorFuera.name}: ${errorFuera.message}` : "SUBIDA ACEPTADA"
    )
  ) {
    fallos.push(
      "un token emitido para un proyecto sirvio para escribir en el prefijo de otro"
    );
  }

  return fallos;
}

let fallos = [];
try {
  fallos = await main();
} catch (error) {
  console.error("\nLa sonda aborto:", error);
  fallos.push(`excepcion: ${error.message}`);
} finally {
  for (const url of creados) {
    try {
      await del(url, { token });
    } catch (error) {
      console.error(`No se pudo borrar ${url}: ${error.message}`);
    }
  }
  console.log(`\nlimpieza: ${creados.length} blob(s) borrados`);
}

if (fallos.length) {
  console.log("\nHALLAZGOS:");
  for (const f of fallos) console.log(` - ${f}`);
  process.exit(1);
}
console.log("\nTodo conforme.");
