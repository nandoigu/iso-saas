"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import {
  appPanelStyle,
  appPrimaryButtonStyle,
  appSecondaryButtonStyle,
  appFormLabelStyle,
  appEmptyStateStyle,
  getActionStateStyle,
} from "@/components/uiStyles";

export type RequisitoDelPanel = {
  id: string;
  item: string;
  titulo: string;
  criterioAceptacion: string | null;
};

export type DocumentoPresentado = {
  id: string;
  title: string;
  linkType: string;
};

type Props = {
  projectId: string;
  requirement: RequisitoDelPanel;
  documentos: DocumentoPresentado[];
  onClose: () => void;
  onUploaded: () => void;
};

// Solo "primary" y "supporting": marcar una evidencia como contradictoria es
// juzgar el cumplimiento, y eso es del auditor (ADR-010). La ruta devuelve 403.
const TIPOS_DECLARABLES = [
  { valor: "primary", etiqueta: "Documento principal" },
  { valor: "supporting", etiqueta: "Documento de apoyo" },
] as const;

/**
 * Un solo gesto en tres pasos encadenados: subida del binario por client upload,
 * alta de la evidencia y declaracion del vinculo bajo el requisito. La declaracion
 * va por su propia ruta a proposito: meter `requirementId` en el alta crearia el
 * vinculo fuera de la ruta que ADR-010 le asigno.
 */
export default function RequirementEvidencePanel({
  projectId,
  requirement,
  documentos,
  onClose,
  onUploaded,
}: Props) {
  const [fichero, setFichero] = useState<File | null>(null);
  const [linkType, setLinkType] = useState<string>("primary");
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function presentar() {
    if (!fichero) return;
    setSubiendo(true);
    setError(null);

    try {
      // `private` porque el store lo es y rechaza cualquier escritura publica
      // (ADR-014). La ruta debe ir bajo `evidence/{projectId}/`: el token solo se
      // emite para ese prefijo (`handleEvidenceUploadToken`).
      const blob = await upload(`evidence/${projectId}/${fichero.name}`, fichero, {
        access: "private",
        handleUploadUrl: `/api/projects/${projectId}/evidence/upload-token`,
      });

      // `sourceRef` guarda el pathname, no la URL: la ruta `file` firma la URL
      // de lectura a partir del pathname (`createEvidenceFileSignedUrl`).
      const resEvidencia = await fetch(`/api/projects/${projectId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fichero.name,
          type: "document",
          sourceRef: blob.pathname,
          mediaType: fichero.type || "application/octet-stream",
          sizeBytes: fichero.size,
        }),
      });

      const evidencia = await resEvidencia.json();
      if (!resEvidencia.ok) {
        throw new Error(evidencia.error ?? "No se pudo registrar la evidencia.");
      }

      const resVinculo = await fetch(
        `/api/projects/${projectId}/requirements/${requirement.id}/evidence-links`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ evidenceItemId: evidencia.data.id, linkType }),
        }
      );

      if (!resVinculo.ok) {
        const fallo = await resVinculo.json();
        throw new Error(fallo.error ?? "No se pudo declarar el vinculo.");
      }

      setFichero(null);
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al presentar el documento.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <aside style={{ ...appPanelStyle, position: "sticky", top: 16 }}>
      <h3 style={{ margin: "0 0 4px" }}>
        {requirement.item} · {requirement.titulo}
      </h3>

      {requirement.criterioAceptacion ? (
        <p style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: "0 0 16px" }}>
          {requirement.criterioAceptacion}
        </p>
      ) : (
        <p style={{ ...appEmptyStateStyle, margin: "0 0 16px" }}>
          Este requisito todavía no tiene criterio de aceptación escrito.
        </p>
      )}

      <h4 style={appFormLabelStyle}>Documentos presentados</h4>
      {documentos.length === 0 ? (
        <p style={appEmptyStateStyle}>Ninguno todavía.</p>
      ) : (
        <ul style={{ paddingLeft: 18, margin: "0 0 16px" }}>
          {documentos.map((doc) => (
            <li key={doc.id} style={{ fontSize: 13 }}>
              {doc.title}{" "}
              <span style={{ opacity: 0.6 }}>
                ({TIPOS_DECLARABLES.find((t) => t.valor === doc.linkType)?.etiqueta ??
                  doc.linkType})
              </span>
            </li>
          ))}
        </ul>
      )}

      <label style={appFormLabelStyle} htmlFor="fichero-evidencia">
        Presentar un documento
      </label>
      <input
        id="fichero-evidencia"
        type="file"
        onChange={(e) => setFichero(e.target.files?.[0] ?? null)}
        disabled={subiendo}
      />

      <div style={{ margin: "12px 0" }}>
        {TIPOS_DECLARABLES.map((tipo) => (
          <label key={tipo.valor} style={{ display: "block", fontSize: 13 }}>
            <input
              type="radio"
              name="linkType"
              value={tipo.valor}
              checked={linkType === tipo.valor}
              onChange={() => setLinkType(tipo.valor)}
              disabled={subiendo}
            />{" "}
            {tipo.etiqueta}
          </label>
        ))}
      </div>

      {error && (
        <p role="alert" style={{ color: "#b91c1c", fontSize: 13 }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={presentar}
          disabled={!fichero || subiendo}
          style={{ ...appPrimaryButtonStyle, ...getActionStateStyle(!fichero || subiendo) }}
        >
          {subiendo ? "Presentando..." : "Presentar"}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={appSecondaryButtonStyle}
          disabled={subiendo}
        >
          Cerrar
        </button>
      </div>
    </aside>
  );
}
