// Tipos y constantes del catalogo documental (contrato: docs/api-contracts/documentacion-justificacion.md).
// Sin imports de servidor: lo usan tambien los componentes de cliente.

export const FASES_ORDEN = [
  "oferta",
  "contratacion",
  "movilizacion",
  "produccion",
  "entrega",
  "cierre",
] as const;
export type Fase = (typeof FASES_ORDEN)[number];

export const FASE_ETIQUETA: Record<Fase, string> = {
  oferta: "Oferta",
  contratacion: "Contratación",
  movilizacion: "Movilización",
  produccion: "Producción",
  entrega: "Entrega",
  cierre: "Cierre",
};

export const PROJECT_ROLES = ["adjudicador", "adjudicatario_principal", "adjudicatario"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const FORMATOS = ["docx", "xlsx"] as const;
export type Formato = (typeof FORMATOS)[number];

export const TIPOS = ["iso", "administrativa", "ambas"] as const;
export type Tipo = (typeof TIPOS)[number];

// Fila del libro ya normalizada por el parser (antes de resolver requisitos)
export type ParsedDocumentTemplateRow = {
  fila: number;
  fichero: string;
  nombre: string;
  formato: Formato;
  vigente: boolean;
  roles: ProjectRole[];
  fase: Fase;
  obligatoria: boolean;
  tipo: Tipo;
  referencias: { norma: string; item: string }[];
};

export type ProjectDocumentTemplate = {
  id: string;
  nombre: string;
  formato: string;
  fase: string;
  obligatoria: boolean;
  tipo: string;
};

export type DocumentTemplateImportSummary = {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  retired: number;
  links: number;
};

export type DocumentTemplateActor = {
  userId: string;
  isAdmin: boolean;
};
