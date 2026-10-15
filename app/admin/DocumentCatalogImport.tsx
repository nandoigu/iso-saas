"use client";

import { useState, type CSSProperties } from "react";
import { Notice } from "@/components/Notice";
import {
  appFieldStyle,
  appPanelStyle,
  appPrimaryButtonStyle,
  getActionStateStyle,
} from "@/components/uiStyles";
import type { DocumentTemplateImportSummary } from "@/services/document-template.types";

const ERROR_IMPORTACION = "No se pudo importar el catálogo documental.";

type Props = { style?: CSSProperties };

export default function DocumentCatalogImport({ style }: Props) {
  const [fichero, setFichero] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [resumen, setResumen] = useState<DocumentTemplateImportSummary | null>(null);
  const [error, setError] = useState("");
  const [detalles, setDetalles] = useState<string[]>([]);
  const bloqueado = !fichero || importando;

  async function importar() {
    if (!fichero) return;
    setImportando(true);
    setError("");
    setDetalles([]);
    setResumen(null);
    try {
      const datos = new FormData();
      datos.append("file", fichero);
      const res = await fetch("/api/admin/document-templates/import", { method: "POST", body: datos });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? ERROR_IMPORTACION);
        setDetalles(Array.isArray(body?.details) ? body.details : []);
        return;
      }
      setResumen(body.data);
    } catch {
      setError(ERROR_IMPORTACION);
    } finally {
      setImportando(false);
    }
  }

  return (
    <section style={style ?? appPanelStyle} aria-labelledby="catalogo-documental-titulo">
      <h2 id="catalogo-documental-titulo" style={{ margin: 0, fontSize: 20 }}>
        Catálogo documental
      </h2>
      <p style={{ margin: "6px 0 16px", color: "#475569" }}>
        Sube el libro <code>plantillas_documentales.xlsx</code>. La importación es de todo o
        nada: si una fila tiene errores, no cambia nada. Las plantillas que ya no estén en el
        libro dejan de ofrecerse, pero no se borran.
      </p>
      <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 10 }}>
        <input
          type="file"
          accept=".xlsx"
          aria-label="Libro del catálogo documental"
          style={appFieldStyle}
          onChange={(e) => setFichero(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={importar}
          disabled={bloqueado}
          aria-disabled={bloqueado}
          style={{ ...appPrimaryButtonStyle, ...getActionStateStyle(bloqueado) }}
        >
          {importando ? "Importando…" : "Importar catálogo documental"}
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 12 }}>
          <Notice tone="error" message={error} />
          {detalles.length > 0 ? (
            <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
              {detalles.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {resumen ? (
        <div style={{ marginTop: 12 }}>
          <Notice
            tone="success"
            message={`Catálogo importado: ${resumen.total} plantillas en el libro; ${resumen.created} nuevas, ${resumen.updated} actualizadas, ${resumen.unchanged} sin cambios y ${resumen.retired} retiradas. ${resumen.links} vínculos con requisitos.`}
          />
        </div>
      ) : null}
    </section>
  );
}
