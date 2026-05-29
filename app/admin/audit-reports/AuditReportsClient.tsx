"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Notice } from "@/components/Notice";
import {
  appFieldStyle,
  appHeroCopyStyle,
  appHeroDescriptionStyle,
  appHeroEyebrowStyle,
  appHeroStyle,
  appHeroTitleStyle,
  appPageStyle,
  appPanelStyle,
  appPrimaryButtonStyle,
  appSecondaryButtonStyle,
  appTableCellStyle,
  appTableHeaderStyle,
  appTableStyle,
  getActionStateStyle,
} from "@/components/uiStyles";

type Project = {
  id: string;
  name: string;
  code?: string | null;
};

type AuditReport = {
  id: string;
  reportNumber: string;
  version: number;
  auditType: string;
  auditedOrgName: string;
  complianceScore: number;
  maturityScore: number;
  riskScore: number;
  confidenceScore: number;
  globalStatus: string;
  finalOpinion: string;
  updatedAt: string;
  project?: Project | null;
  generatedContent?: {
    executiveSummary?: Array<{ id: string; text: string; confidenceScore: number }>;
    isoEvaluation?: Array<{ domain: string; result: string; complianceLevel: number }>;
    nonConformities?: Array<{ id: string; severity: string; description: string }>;
  };
};

const auditTypes = ["Fase 1", "Fase 2", "Seguimiento", "Renovacion", "Extraordinaria"];

export default function AuditReportsClient() {
  const [reports, setReports] = useState<AuditReport[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [auditType, setAuditType] = useState("Fase 2");
  const [scope, setScope] = useState("");
  const [leadAuditor, setLeadAuditor] = useState("Auditor jefe BAOS");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) || reports[0] || null,
    [reports, selectedReportId]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [reportsResult, projectsResult] = await Promise.all([
        fetchJson<{ data: AuditReport[] }>("/api/admin/audit-reports"),
        fetchJson<Project[]>("/api/projects"),
      ]);
      const loadErrors = [reportsResult.error, projectsResult.error].filter(Boolean);
      const loadedReports = reportsResult.data?.data ?? [];
      const loadedProjects = projectsResult.data ?? [];

      if (reportsResult.data) {
        setReports(Array.isArray(loadedReports) ? loadedReports : []);
      }

      if (projectsResult.data) {
        setProjects(Array.isArray(loadedProjects) ? loadedProjects : []);
        setSelectedProjectId((current) => current || loadedProjects[0]?.id || "");
      }

      setSelectedReportId((current) => current || loadedReports[0]?.id || null);

      if (loadErrors.length > 0) {
        setError(loadErrors.join(" "));
      }
    } catch (loadError) {
      console.error(loadError);
      setError("No se pudo cargar el generador de informes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createReport = async () => {
    if (!selectedProjectId) {
      setError("Selecciona un proyecto para generar el informe.");
      return;
    }

    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/audit-reports", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          auditType,
          scope,
          leadAuditor: { name: leadAuditor, initials: initials(leadAuditor) },
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "No se pudo generar el informe.");
      }

      await loadData();
      setSelectedReportId(data.data.id);
      setSuccess(`Informe ${data.data.reportNumber} generado correctamente.`);
    } catch (createError) {
      console.error(createError);
      setError(createError instanceof Error ? createError.message : "No se pudo generar el informe.");
    } finally {
      setCreating(false);
    }
  };

  const regenerate = async (reportId: string) => {
    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/admin/audit-reports/${reportId}`, {
        method: "PATCH",
        credentials: "same-origin",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "No se pudo versionar el informe.");
      }

      await loadData();
      setSelectedReportId(reportId);
      setSuccess(`Nueva version v${data.data.version} generada.`);
    } catch (regenerateError) {
      console.error(regenerateError);
      setError(regenerateError instanceof Error ? regenerateError.message : "No se pudo versionar el informe.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <main style={{ ...appPageStyle, display: "grid", gap: 20 }}>
      <section style={appHeroStyle}>
        <div style={appHeroCopyStyle}>
          <span style={appHeroEyebrowStyle}>Audit Report Generator</span>
          <h1 style={appHeroTitleStyle}>Informes de auditoria ISO 19650</h1>
          <p style={appHeroDescriptionStyle}>
            Generacion documental con versionado, trazabilidad interna por requisito/evidencia y exportacion profesional a DOCX y PDF. Disponible solo para Admin.
          </p>
        </div>
        <Link href="/admin" style={secondaryLinkStyle}>
          Volver a Admin
        </Link>
      </section>

      {error && <Notice tone="error" message={error} />}
      {success && <Notice tone="success" message={success} />}

      <section style={gridStyle}>
        <div style={panelStyle}>
          <h2 style={sectionTitleStyle}>Generar informe</h2>
          <label style={labelStyle}>
            Proyecto
            <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} style={appFieldStyle}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}{project.code ? ` (${project.code})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Tipo de auditoria
            <select value={auditType} onChange={(event) => setAuditType(event.target.value)} style={appFieldStyle}>
              {auditTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Auditor jefe
            <input value={leadAuditor} onChange={(event) => setLeadAuditor(event.target.value)} style={appFieldStyle} />
          </label>
          <label style={labelStyle}>
            Alcance
            <textarea value={scope} onChange={(event) => setScope(event.target.value)} rows={4} style={appFieldStyle} />
          </label>
          <button type="button" onClick={createReport} disabled={creating || loading} style={{ ...appPrimaryButtonStyle, ...getActionStateStyle(creating || loading) }}>
            {creating ? "Generando..." : "Generar informe"}
          </button>
        </div>

        <div style={panelStyle}>
          <h2 style={sectionTitleStyle}>Informes generados</h2>
          <div style={tableWrapperStyle}>
            <table style={{ ...appTableStyle, minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={appTableHeaderStyle}>Informe</th>
                  <th style={appTableHeaderStyle}>Proyecto</th>
                  <th style={appTableHeaderStyle}>Estado</th>
                  <th style={appTableHeaderStyle}>Version</th>
                  <th style={appTableHeaderStyle}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td style={appTableCellStyle}>{report.reportNumber}</td>
                    <td style={appTableCellStyle}>{report.project?.name || report.auditedOrgName}</td>
                    <td style={appTableCellStyle}>{report.globalStatus}</td>
                    <td style={appTableCellStyle}>v{report.version}</td>
                    <td style={appTableCellStyle}>
                      <div style={actionRowStyle}>
                        <button type="button" onClick={() => setSelectedReportId(report.id)} style={smallButtonStyle}>
                          Ver
                        </button>
                        <a href={`/api/admin/audit-reports/${report.id}/export/docx`} style={smallLinkStyle}>DOCX</a>
                        <a href={`/api/admin/audit-reports/${report.id}/export/pdf`} style={smallLinkStyle}>PDF</a>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && reports.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ ...appTableCellStyle, textAlign: "center", color: "#64748b" }}>
                      Todavia no hay informes generados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {selectedReport && (
        <section style={panelStyle}>
          <div style={previewHeaderStyle}>
            <div>
              <span style={appHeroEyebrowStyle}>Previsualizacion</span>
              <h2 style={sectionTitleStyle}>{selectedReport.reportNumber} · {selectedReport.auditedOrgName}</h2>
            </div>
            <div style={actionRowStyle}>
              <button type="button" onClick={() => regenerate(selectedReport.id)} disabled={creating} style={{ ...appSecondaryButtonStyle, ...getActionStateStyle(creating) }}>
                Versionar
              </button>
              <a href={`/api/admin/audit-reports/${selectedReport.id}/export/docx`} style={primaryLinkStyle}>Exportar DOCX</a>
              <a href={`/api/admin/audit-reports/${selectedReport.id}/export/pdf`} style={primaryLinkStyle}>Exportar PDF</a>
            </div>
          </div>

          <div style={kpiGridStyle}>
            <Kpi label="Compliance" value={selectedReport.complianceScore} />
            <Kpi label="Maturity" value={selectedReport.maturityScore} />
            <Kpi label="Risk" value={selectedReport.riskScore} />
            <Kpi label="Confidence" value={selectedReport.confidenceScore} />
          </div>

          <div style={previewGridStyle}>
            <PreviewBlock title="Resumen ejecutivo" items={(selectedReport.generatedContent?.executiveSummary || []).map((item) => item.text)} />
            <PreviewBlock title="Evaluacion ISO 19650" items={(selectedReport.generatedContent?.isoEvaluation || []).map((item) => `${item.domain}: ${item.result} (${item.complianceLevel}/100)`)} />
            <PreviewBlock title="No conformidades" items={(selectedReport.generatedContent?.nonConformities || []).map((item) => `${item.id} · ${item.severity}: ${item.description}`)} />
          </div>
        </section>
      )}
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div style={kpiStyle}>
      <span style={kpiLabelStyle}>{label}</span>
      <strong style={kpiValueStyle}>{value}/100</strong>
    </div>
  );
}

function PreviewBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={previewBlockStyle}>
      <h3 style={previewTitleStyle}>{title}</h3>
      <ul style={listStyle}>
        {(items.length ? items : ["Sin datos"]).slice(0, 12).map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "BA";
}

async function fetchJson<T>(url: string): Promise<{ data?: T; error?: string }> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const message = data?.error || `HTTP ${res.status}`;
      return { error: `${url}: ${message}` };
    }

    return { data: data as T };
  } catch (error) {
    return {
      error: `${url}: ${
        error instanceof Error ? error.message : "No se pudo completar la peticion"
      }`,
    };
  }
}

const gridStyle: React.CSSProperties = {
  alignItems: "start",
  display: "grid",
  gap: 18,
  gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)",
};

const panelStyle: React.CSSProperties = {
  ...appPanelStyle,
  display: "grid",
  gap: 14,
  padding: 18,
};

const sectionTitleStyle: React.CSSProperties = {
  color: "#002a4e",
  fontSize: 19,
  fontWeight: 600,
  margin: 0,
};

const labelStyle: React.CSSProperties = {
  color: "#1e293b",
  display: "grid",
  fontSize: 14,
  fontWeight: 600,
  gap: 6,
};

const tableWrapperStyle: React.CSSProperties = {
  overflowX: "auto",
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const smallButtonStyle: React.CSSProperties = {
  ...appSecondaryButtonStyle,
  minHeight: 32,
  padding: "5px 9px",
};

const smallLinkStyle: React.CSSProperties = {
  ...smallButtonStyle,
  color: "#0f172a",
  textDecoration: "none",
};

const primaryLinkStyle: React.CSSProperties = {
  ...appPrimaryButtonStyle,
  alignItems: "center",
  display: "inline-flex",
  minHeight: 38,
  textDecoration: "none",
};

const secondaryLinkStyle: React.CSSProperties = {
  ...appSecondaryButtonStyle,
  alignItems: "center",
  display: "inline-flex",
  textDecoration: "none",
};

const previewHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 14,
  justifyContent: "space-between",
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(4, minmax(120px, 1fr))",
};

const kpiStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #dbe3f1",
  borderRadius: 8,
  display: "grid",
  gap: 4,
  padding: 14,
};

const kpiLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 600,
  textTransform: "uppercase",
};

const kpiValueStyle: React.CSSProperties = {
  color: "#002a4e",
  fontSize: 24,
};

const previewGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
};

const previewBlockStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 14,
};

const previewTitleStyle: React.CSSProperties = {
  color: "#002a4e",
  fontSize: 15,
  margin: "0 0 10px",
};

const listStyle: React.CSSProperties = {
  color: "#334155",
  display: "grid",
  fontSize: 13,
  gap: 8,
  lineHeight: 1.45,
  margin: 0,
  paddingLeft: 18,
};
