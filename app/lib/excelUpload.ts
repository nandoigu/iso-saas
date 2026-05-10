export const MAX_XLSX_UPLOAD_BYTES = 5 * 1024 * 1024;

const XLSX_EXTENSION = ".xlsx";
const XLSX_SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08],
] as const;

export async function readSafeXlsxUpload(file: File) {
  if (!file.name.toLowerCase().endsWith(XLSX_EXTENSION)) {
    return {
      ok: false as const,
      error: "Formato no valido. Solo se aceptan archivos .xlsx.",
    };
  }

  if (file.size <= 0) {
    return {
      ok: false as const,
      error: "El archivo esta vacio.",
    };
  }

  if (file.size > MAX_XLSX_UPLOAD_BYTES) {
    return {
      ok: false as const,
      error: `El archivo supera el limite de ${formatMegabytes(
        MAX_XLSX_UPLOAD_BYTES
      )} MB.`,
    };
  }

  const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());

  if (!hasXlsxSignature(header)) {
    return {
      ok: false as const,
      error: "El archivo no parece ser un .xlsx valido.",
    };
  }

  return {
    ok: true as const,
    buffer: await file.arrayBuffer(),
  };
}

function hasXlsxSignature(header: Uint8Array) {
  return XLSX_SIGNATURES.some((signature) =>
    signature.every((byte, index) => header[index] === byte)
  );
}

function formatMegabytes(bytes: number) {
  return Math.round(bytes / (1024 * 1024));
}
