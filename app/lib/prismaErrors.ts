// P2003: violacion de clave foranea (p. ej. onDelete: Restrict).
export function isForeignKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2003"
  );
}
