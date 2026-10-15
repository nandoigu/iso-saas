import path from "path";

// Los binarios viajan dentro del bundle de las rutas que los leen (ADR-016 D1,
// outputFileTracingIncludes en next.config.ts). Punto unico para poder mockearlo en tests.
export function getPlantillasDir() {
  return path.join(process.cwd(), "docs", "fuentes", "plantillas-iso");
}
