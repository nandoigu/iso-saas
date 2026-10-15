"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Notice } from "@/components/Notice";
import {
  appBadgeBaseStyle,
  appEmptyStateStyle,
  appPanelStyle,
  appSecondaryButtonStyle,
} from "@/components/uiStyles";
import { getProjectRoleLabel } from "@/app/lib/projectRoles";
import { FASES_ORDEN, FASE_ETIQUETA, type Fase } from "@/services/document-template.types";

// Entrega 1 (ADR-016): solo catalogo y descarga. Sin estado ni subida, que llegan en la entrega 2.
// Una pestana por fase, cada fase con su color, para que se vea a que fase pertenece cada documento.

type Plantilla = {
  id: string;
  nombre: string;
  formato: string;
  fase: string;
  obligatoria: boolean;
  tipo: string;
};

// onTotalChange: la pagina del proyecto muestra el recuento en su pestana «Documentación».
type Props = { projectId: string; onTotalChange?: (total: number) => void };

const ERROR_CARGA = "No se pudo cargar la documentación del proyecto.";

const TINTA = "#002a4e";
const TEXTO_SECUNDARIO = "#5b6b82";
const LINEA = "#dbe3f1";

// Color por fase. `fuerte` sobre `suave` cumple AA (>= 4.5:1) en todas.
const COLOR_FASE: Record<Fase, { fuerte: string; suave: string; borde: string }> = {
  oferta: { fuerte: "#0025df", suave: "#eef1ff", borde: "#c7d0fb" },
  contratacion: { fuerte: "#6d28d9", suave: "#f5f3ff", borde: "#ddd6fe" },
  movilizacion: { fuerte: "#b45309", suave: "#fffbeb", borde: "#fde68a" },
  produccion: { fuerte: "#15803d", suave: "#f0fdf4", borde: "#bbf7d0" },
  entrega: { fuerte: "#0f766e", suave: "#f0fdfa", borde: "#99f6e4" },
  cierre: { fuerte: "#334155", suave: "#f1f5f9", borde: "#cbd5e1" },
};

const idPestana = (fase: Fase) => `documentacion-pestana-${fase}`;
const idPanel = (fase: Fase) => `documentacion-panel-${fase}`;

function plural(n: number, singular: string, pluralForm: string) {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

export default function ProjectDocumentsSection({ projectId, onTotalChange }: Props) {
  const [plantillas, setPlantillas] = useState<Plantilla[] | null>(null);
  const [projectRole, setProjectRole] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [faseElegida, setFaseElegida] = useState<Fase | null>(null);
  const pestanas = useRef<Partial<Record<Fase, HTMLButtonElement | null>>>({});

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/document-templates`,
          { cache: "no-store" }
        );
        const body = await res.json().catch(() => null);
        if (cancelado) return;
        if (!res.ok) {
          setError(body?.error ?? ERROR_CARGA);
          return;
        }
        setProjectRole(body.data.projectRole);
        setPlantillas(body.data.templates);
        onTotalChange?.(body.data.templates.length);
      } catch {
        if (!cancelado) setError(ERROR_CARGA);
      }
    }

    void cargar();
    return () => {
      cancelado = true;
    };
  }, [projectId, onTotalChange]);

  const urlDescarga = (templateId: string) =>
    `/api/projects/${encodeURIComponent(projectId)}/document-templates/${encodeURIComponent(templateId)}/file`;

  // Dentro de cada fase, primero las obligatorias; el servidor ya ordena por nombre.
  const porFase = FASES_ORDEN.map((fase) => {
    const deLaFase = (plantillas ?? [])
      .filter((p) => p.fase === fase)
      .sort((a, b) => Number(b.obligatoria) - Number(a.obligatoria));
    return { fase, plantillas: deLaFase, obligatorias: deLaFase.filter((p) => p.obligatoria).length };
  });

  // Sin eleccion del usuario, se abre la primera fase con plantillas.
  const fase: Fase = faseElegida ?? porFase.find((f) => f.plantillas.length > 0)?.fase ?? FASES_ORDEN[0];
  const actual = porFase.find((f) => f.fase === fase)!;
  const color = COLOR_FASE[fase];

  const total = plantillas?.length ?? 0;
  const totalObligatorias = plantillas?.filter((p) => p.obligatoria).length ?? 0;

  function elegir(nueva: Fase, enfocar = false) {
    setFaseElegida(nueva);
    if (enfocar) pestanas.current[nueva]?.focus();
  }

  // Patron WAI-ARIA de pestanas: flechas, Inicio y Fin mueven el foco y activan.
  function alTeclear(e: KeyboardEvent<HTMLDivElement>) {
    const i = FASES_ORDEN.indexOf(fase);
    const destino =
      e.key === "ArrowRight" ? FASES_ORDEN[(i + 1) % FASES_ORDEN.length]
      : e.key === "ArrowLeft" ? FASES_ORDEN[(i - 1 + FASES_ORDEN.length) % FASES_ORDEN.length]
      : e.key === "Home" ? FASES_ORDEN[0]
      : e.key === "End" ? FASES_ORDEN[FASES_ORDEN.length - 1]
      : null;
    if (!destino) return;
    e.preventDefault();
    elegir(destino, true);
  }

  return (
    <section
      id="documentacion"
      style={{ ...appPanelStyle, padding: "20px clamp(16px, 3vw, 24px)" }}
      aria-labelledby="documentacion-titulo"
    >
      <style>{ESTILOS}</style>

      <header style={{ display: "grid", gap: 6 }}>
        <h2 id="documentacion-titulo" style={{ color: TINTA, fontSize: 20, fontWeight: 600, margin: 0 }}>
          Documentación
        </h2>
        <p style={{ color: TEXTO_SECUNDARIO, lineHeight: 1.5, margin: 0, maxWidth: "70ch" }}>
          Plantillas de Eficax para justificar el proyecto, agrupadas por la fase en la que se
          preparan. Elige una fase y descarga la versión vigente de cada plantilla.
        </p>
        {plantillas && plantillas.length > 0 ? (
          <p style={{ color: TINTA, fontSize: 14, margin: "4px 0 0" }}>
            <strong>{plural(total, "plantilla", "plantillas")}</strong>
            {" · "}
            {plural(totalObligatorias, "obligatoria", "obligatorias")}
            {projectRole ? ` · rol ${getProjectRoleLabel(projectRole).toLowerCase()}` : null}
          </p>
        ) : null}
      </header>

      {error ? (
        <div style={{ marginTop: 16 }}>
          <Notice tone="error" message={error} compact />
        </div>
      ) : null}

      {plantillas === null && !error ? <EsqueletoCarga /> : null}

      {plantillas?.length === 0 ? (
        <div style={{ ...appEmptyStateStyle, marginTop: 16 }}>
          Todavía no hay plantillas documentales para el rol de este proyecto. Cuando el
          administrador cargue el catálogo, aparecerán aquí agrupadas por fase.
        </div>
      ) : null}

      {plantillas && plantillas.length > 0 ? (
        <div style={{ marginTop: 18 }}>
          <div
            role="tablist"
            aria-label="Fases del proyecto"
            className="doc-fases"
            onKeyDown={alTeclear}
            style={{ borderBottom: `1px solid ${LINEA}`, display: "flex", gap: 4, overflowX: "auto", overflowY: "hidden", paddingTop: 2 }}
          >
            {porFase.map(({ fase: f, plantillas: deLaFase }, i) => {
              const activa = f === fase;
              const vacia = deLaFase.length === 0;
              const c = COLOR_FASE[f];
              return (
                <button
                  key={f}
                  ref={(el) => {
                    pestanas.current[f] = el;
                  }}
                  type="button"
                  role="tab"
                  id={idPestana(f)}
                  aria-selected={activa}
                  aria-controls={idPanel(f)}
                  tabIndex={activa ? 0 : -1}
                  className="doc-pestana"
                  onClick={() => elegir(f)}
                  style={{
                    alignItems: "center",
                    background: activa ? c.suave : "transparent",
                    border: "none",
                    borderBottom: `3px solid ${activa ? c.fuerte : "transparent"}`,
                    borderRadius: "8px 8px 0 0",
                    color: activa ? c.fuerte : vacia ? "#64748b" : TINTA,
                    cursor: "pointer",
                    display: "inline-flex",
                    flexShrink: 0,
                    fontSize: 14,
                    fontWeight: activa ? 600 : 500,
                    gap: 8,
                    marginBottom: -1,
                    minHeight: 44,
                    padding: "8px 14px",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      alignItems: "center",
                      background: vacia ? "#e2e8f0" : c.fuerte,
                      borderRadius: 999,
                      color: vacia ? "#64748b" : "#ffffff",
                      display: "inline-flex",
                      fontSize: 11,
                      fontWeight: 700,
                      height: 20,
                      justifyContent: "center",
                      width: 20,
                    }}
                  >
                    {i + 1}
                  </span>
                  {FASE_ETIQUETA[f]}
                  <span
                    style={{
                      background: activa ? "#ffffff" : "#f1f5f9",
                      borderRadius: 999,
                      color: vacia ? "#64748b" : "#334155",
                      fontSize: 12,
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 600,
                      minWidth: 22,
                      padding: "1px 7px",
                      textAlign: "center",
                    }}
                  >
                    <span className="doc-oculto">, </span>
                    {deLaFase.length}
                    <span className="doc-oculto"> {deLaFase.length === 1 ? "plantilla" : "plantillas"}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div
            key={fase}
            role="tabpanel"
            id={idPanel(fase)}
            aria-labelledby={idPestana(fase)}
            tabIndex={0}
            className="doc-panel"
            style={{
              border: `1px solid ${color.borde}`,
              borderRadius: 10,
              marginTop: 16,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                alignItems: "center",
                background: color.suave,
                borderBottom: `1px solid ${color.borde}`,
                display: "flex",
                flexWrap: "wrap",
                gap: "6px 14px",
                padding: "14px 16px",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  alignItems: "center",
                  background: color.fuerte,
                  borderRadius: 999,
                  color: "#ffffff",
                  display: "inline-flex",
                  fontSize: 14,
                  fontWeight: 700,
                  height: 30,
                  justifyContent: "center",
                  width: 30,
                }}
              >
                {FASES_ORDEN.indexOf(fase) + 1}
              </span>
              <h3 style={{ color: color.fuerte, fontSize: 18, fontWeight: 600, margin: 0 }}>
                {FASE_ETIQUETA[fase]}
              </h3>
              <span style={{ color: "#334155", fontSize: 14 }}>
                {actual.plantillas.length === 0
                  ? "Sin plantillas para este rol"
                  : `${plural(actual.plantillas.length, "plantilla", "plantillas")} · ${plural(actual.obligatorias, "obligatoria", "obligatorias")}`}
              </span>
            </div>

            {actual.plantillas.length === 0 ? (
              <p style={{ color: TEXTO_SECUNDARIO, margin: 0, padding: "18px 16px" }}>
                El catálogo no tiene plantillas de {FASE_ETIQUETA[fase].toLowerCase()} para el rol de
                este proyecto.
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {actual.plantillas.map((p, j) => (
                  <li
                    key={p.id}
                    className="doc-fila"
                    style={{
                      alignItems: "center",
                      borderTop: j === 0 ? "none" : `1px solid ${LINEA}`,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      justifyContent: "space-between",
                      padding: "12px 16px",
                    }}
                  >
                    <div style={{ alignItems: "center", display: "flex", gap: 12, minWidth: 0, flex: "1 1 260px" }}>
                      <IconoFichero formato={p.formato} />
                      <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                        <span style={{ color: "#0f172a", fontSize: 14, fontWeight: 500, lineHeight: 1.4, overflowWrap: "anywhere" }}>
                          {p.nombre}
                        </span>
                        <span style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {p.obligatoria ? (
                            <span style={obligatoriaStyle}>Obligatoria</span>
                          ) : (
                            <span style={opcionalStyle}>Opcional</span>
                          )}
                          <span style={{ color: "#475569", fontSize: 12, fontWeight: 600 }}>
                            {p.formato.toUpperCase()}
                          </span>
                        </span>
                      </div>
                    </div>
                    <a
                      href={urlDescarga(p.id)}
                      className="doc-descarga"
                      style={{
                        ...appSecondaryButtonStyle,
                        alignItems: "center",
                        display: "inline-flex",
                        gap: 6,
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                      }}
                      aria-label={`Descargar ${p.nombre} (${p.formato.toUpperCase()})`}
                      download
                    >
                      <IconoDescarga />
                      Descargar
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function EsqueletoCarga() {
  const bloque = (ancho: number | string, alto: number): CSSProperties => ({
    background: "#eef2f7",
    borderRadius: 6,
    height: alto,
    width: ancho,
  });
  return (
    <div role="status" aria-label="Cargando documentación" style={{ display: "grid", gap: 14, marginTop: 18 }}>
      <div style={{ display: "flex", gap: 8, overflow: "hidden" }}>
        {[110, 140, 140, 120, 100, 90].map((w, i) => (
          <span key={i} style={{ ...bloque(w, 36), flexShrink: 0 }} />
        ))}
      </div>
      <span style={bloque("100%", 52)} />
      {[0, 1, 2].map((i) => (
        <span key={i} style={bloque("100%", 40)} />
      ))}
    </div>
  );
}

function IconoFichero({ formato }: { formato: string }) {
  // Colores habituales de Word y Excel: el usuario reconoce el tipo antes de leer.
  const excel = formato === "xlsx";
  return (
    <span
      aria-hidden="true"
      style={{
        alignItems: "center",
        background: excel ? "#e8f5ee" : "#e8effc",
        borderRadius: 8,
        color: excel ? "#107c41" : "#185abd",
        display: "inline-flex",
        flexShrink: 0,
        height: 36,
        justifyContent: "center",
        width: 36,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M4.5 1.75h6l3 3v11.5h-9V1.75Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M10.5 1.75v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        {excel ? (
          <path d="M6.75 8.5h4.5M6.75 11h4.5M6.75 13.5h4.5M9 8.5v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        ) : (
          <path d="M6.75 8.75h4.5M6.75 11h4.5M6.75 13.25h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        )}
      </svg>
    </span>
  );
}

function IconoDescarga() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2.5v7.5M4.75 7 8 10.25 11.25 7M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Estados que los estilos en linea no cubren: hover, foco visible, texto solo para lectores
// de pantalla y la entrada del panel (con alternativa sin movimiento).
const ESTILOS = `
.doc-pestana:hover[aria-selected="false"] { background: #f8fafc !important; }
.doc-pestana:focus-visible, .doc-panel:focus-visible, .doc-descarga:focus-visible {
  outline: 2px solid #0025df; outline-offset: 2px;
}
.doc-descarga:hover { background: #f8fafc !important; border-color: #94a3b8 !important; }
.doc-fila:hover { background: #fbfcfe; }
.doc-oculto {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap;
}
.doc-panel { animation: doc-entrada 180ms cubic-bezier(0.22, 1, 0.36, 1); }
@keyframes doc-entrada { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .doc-panel { animation: none; } }
`;

// Marcas neutras: el color queda reservado para identificar la fase.
const obligatoriaStyle: CSSProperties = {
  ...appBadgeBaseStyle,
  background: "#f1f5f9",
  border: "1px solid #cbd5e1",
  color: "#0f172a",
  padding: "2px 8px",
};

const opcionalStyle: CSSProperties = {
  ...appBadgeBaseStyle,
  background: "#ffffff",
  border: "1px dashed #cbd5e1",
  color: "#475569",
  fontWeight: 500,
  padding: "2px 8px",
};
