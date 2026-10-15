// Content-Disposition seguro (security-spec): ASCII sin comillas, barras ni controles en
// `filename`, y el nombre real en `filename*` (RFC 5987, que no admite ' ( ) * sin codificar).
export function contentDisposition(fichero: string) {
  const ascii = fichero
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]|["\\]/g, "_");
  const codificado = encodeURIComponent(fichero).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${codificado}`;
}
