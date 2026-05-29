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

type ReportContent = {
  cover: {
    reportNumber: string;
    auditNumber: string;
    organizationName: string;
    auditType: string;
    standards: string[];
    auditDates: string;
    reportDate: string;
  };
  generalData: {
    projectName: string;
    projectCode: string;
    organizationName: string;
    organizationAddress: string;
    organizationRepresentative: string;
    leadAuditorName: string;
    leadAuditorInitials: string;
    certificationScope: string;
  };
  auditCriteria: string[];
  executiveSummary: Record<
    | "generalIssues"
    | "scopeAdequacy"
    | "auditObjectives"
    | "auditContext"
    | "auditorGeneralConsiderations"
    | "strengths"
    | "weaknessesAndImprovements"
    | "observations"
    | "nonConformities",
    string
  >;
  executiveResult: {
    complianceScore: number;
    riskScore: number;
    confidenceScore: number;
    status: string;
  };
  finalOpinion: {
    decision: string;
    rationale: string;
  };
  annexes: {
    auditMatrix: Array<{ requirementId: string; requirement: string; status: string; evidence: string }>;
    kpis: {
      complianceScore: number;
      riskScore: number;
      confidenceScore: number;
    };
  };
  traceability: Array<{
    section: string;
    requirementIds: string[];
    evidenceIds: string[];
    confidenceScore: number;
  }>;
};

type AuditReport = {
  id: string;
  reportNumber: string;
  version: number;
  auditType: string;
  auditedOrgName: string;
  complianceScore: number;
  riskScore: number;
  confidenceScore: number;
  globalStatus: string;
  finalOpinion: string;
  updatedAt: string;
  project?: Project | null;
  generatedContent?: ReportContent;
};

const auditTypes = ["Fase 1", "Fase 2", "Seguimiento", "Renovacion", "Extraordinaria"];
const summaryFields: Array<{ key: keyof ReportContent["executiveSummary"]; label: string }> = [
  { key: "generalIssues", label: "Cuestiones generales" },
  { key: "scopeAdequacy", label: "Adecuacion del alcance" },
  { key: "auditObjectives", label: "Objetivos de auditoria" },
  { key: "auditContext", label: "Contexto de la auditoria" },
  { key: "auditorGeneralConsiderations", label: "Consideraciones generales del auditor" },
  { key: "strengths", label: "Puntos fuertes" },
  { key: "weaknessesAndImprovements", label: "Debilidades y oportunidades de mejora" },
  { key: "observations", label: "Observaciones" },
  { key: "nonConformities", label: "No conformidades" },
];

export default function AuditReportsClient() {
  const [reports, setReports] = useState<AuditReport[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [auditType, setAuditType] = useState("Fase 2");
  const [scope, setScope] = useState("");
  const [leadAuditor, setLeadAuditor] = useState("Auditor jefe BAOS");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState<ReportContent | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) || reports[0] || null,
    [reports, selectedReportId]
  );

  useEffect(() => {
    setDraftContent(selectedReport?.generatedContent ? cloneContent(selectedReport.generatedContent) : null);
  }, [selectedReport]);

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

      if (reportsResult.data) setReports(Array.isArray(loadedReports) ? loadedReports : []);
      if (projectsResult.data) {
        setProjects(Array.isArray(loadedProjects) ? loadedProjects : []);
        setSelectedProjectId((current) => current || loadedProjects[0]?.id || "");
      }

      setSelectedReportId((current) => current || loadedReports[0]?.id || null);
      if (loadErrors.length > 0) setError(loadErrors.join(" "));
    } catch (loadError) {
      console.error(loadError);
      setError("No se pudo cargar el modulo de informes.");
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

    setSaving(true);
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

      if (!res.ok) throw new Error(data.error || "No se pudo generar el informe.");

      await loadData();
      setSelectedReportId(data.data.id);
      setSuccess(`Informe ${data.data.reportNumber} generado correctamente.`);
    } catch (createError) {
      console.error(createError);
      setError(createError instanceof Error ? createError.message : "No se pudo generar el informe.");
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    if (!selectedReport || !draftContent) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/admin/audit-reports/${selectedReport.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", content: draftContent }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "No se pudo guardar el informe.");

      await loadData();
      setSelectedReportId(selectedReport.id);
      setSuccess(`Informe guardado como version v${data.data.version}.`);
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el informe.");
    } finally {
      setSaving(false);
    }
  };

  const regenerate = async () => {
    if (!selectedReport) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/admin/audit-reports/${selectedReport.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate" }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "No se pudo regenerar el informe.");

      await loadData();
      setSelectedReportId(selectedReport.id);
      setSuccess(`Informe regenerado como version v${data.data.version}.`);
    } catch (regenerateError) {
      console.error(regenerateError);
      setError(regenerateError instanceof Error ? regenerateError.message : "No se pudo regenerar el informe.");
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = (updater: (content: ReportContent) => ReportContent) => {
    setDraftContent((current) => (current ? updater(current) : current));
  };

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div style={appHeroCopyStyle}>
          <span style={appHeroEyebrowStyle}>Informes</span>
          <h1 style={appHeroTitleStyle}>Informes de auditoria ISO 19650</h1>
          <p style={appHeroDescriptionStyle}>
            Version basica estable: genera un informe desde proyecto y requisitos, permite editar la previsualizacion y exporta DOCX/PDF.
          </p>
        </div>
        <Link href="/admin" style={secondaryLinkStyle}>
          Volver a Admin
        </Link>
      </section>

      {error && <Notice tone="error" message={error} />}
      {success && <Notice tone="success" message={success} />}

      <section style={stackStyle}>
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
            Alcance de la certificacion
            <textarea value={scope} onChange={(event) => setScope(event.target.value)} rows={4} style={appFieldStyle} />
          </label>
          <button type="button" onClick={createReport} disabled={saving || loading} style={{ ...appPrimaryButtonStyle, ...getActionStateStyle(saving || loading) }}>
            {saving ? "Procesando..." : "Generar informe"}
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

      {selectedReport && draftContent && (
        <section style={panelStyle}>
          <div style={previewHeaderStyle}>
            <div>
              <span style={appHeroEyebrowStyle}>Informe editable</span>
              <h2 style={sectionTitleStyle}>{selectedReport.reportNumber} · {draftContent.generalData.projectName}</h2>
              <p style={sectionDescriptionStyle}>
                Revisa el contenido en orden documental. Los anexos y KPIs quedan al final del informe.
              </p>
            </div>
            <div style={actionRowStyle}>
              <button type="button" onClick={saveDraft} disabled={saving} style={{ ...appPrimaryButtonStyle, ...getActionStateStyle(saving) }}>
                Guardar version
              </button>
              <button type="button" onClick={regenerate} disabled={saving} style={{ ...appSecondaryButtonStyle, ...getActionStateStyle(saving) }}>
                Regenerar base
              </button>
              <a href={`/api/admin/audit-reports/${selectedReport.id}/export/docx`} style={secondaryLinkStyle}>Exportar DOCX</a>
              <a href={`/api/admin/audit-reports/${selectedReport.id}/export/pdf`} style={secondaryLinkStyle}>Exportar PDF</a>
            </div>
          </div>

          <div style={editorStackStyle}>
            <div style={editorSectionStyle}>
              <SectionHeading number="1" title="Datos generales" />
              <ReadOnlyGrid
                items={[
                  ["Organizacion", draftContent.cover.organizationName],
                  ["Numero auditoria", draftContent.cover.auditNumber],
                  ["Numero informe", draftContent.cover.reportNumber],
                  ["Tipo auditoria", draftContent.cover.auditType],
                  ["Norma aplicable", draftContent.cover.standards.join(", ")],
                  ["Fechas auditoria", draftContent.cover.auditDates],
                  ["Fecha informe", draftContent.cover.reportDate],
                ]}
              />
              <div style={editableCardGridStyle}>
                <EditableCard label="Organizacion" value={draftContent.generalData.organizationName} onChange={(value) => updateDraft((content) => ({ ...content, generalData: { ...content.generalData, organizationName: value } }))} />
                <EditableCard label="Representante" value={draftContent.generalData.organizationRepresentative} onChange={(value) => updateDraft((content) => ({ ...content, generalData: { ...content.generalData, organizationRepresentative: value } }))} />
                <EditableCard label="Auditor jefe" value={draftContent.generalData.leadAuditorName} onChange={(value) => updateDraft((content) => ({ ...content, generalData: { ...content.generalData, leadAuditorName: value } }))} />
              </div>
              <EditableCard label="Alcance de la certificacion" value={draftContent.generalData.certificationScope} multiline prominent onChange={(value) => updateDraft((content) => ({ ...content, generalData: { ...content.generalData, certificationScope: value } }))} />
            </div>

            <div style={editorSectionStyle}>
              <SectionHeading number="2" title="Criterios de auditoria" />
              <TextArea label="Criterios de auditoria" value={draftContent.auditCriteria.join("\n")} onChange={(value) => updateDraft((content) => ({ ...content, auditCriteria: splitLines(value) }))} />
            </div>

            <div style={editorSectionStyle}>
              <SectionHeading number="3" title="Resumen ejecutivo" />
              {summaryFields.map((field) => (
                <TextArea
                  key={field.key}
                  label={field.label}
                  value={draftContent.executiveSummary[field.key]}
                  onChange={(value) =>
                    updateDraft((content) => ({
                      ...content,
                      executiveSummary: { ...content.executiveSummary, [field.key]: value },
                    }))
                  }
                />
              ))}
            </div>

            <div style={editorSectionStyle}>
              <SectionHeading number="4" title="Resultado ejecutivo" />
              <label style={labelStyle}>
                Estado
                <input value={draftContent.executiveResult.status} onChange={(event) => updateDraft((content) => ({ ...content, executiveResult: { ...content.executiveResult, status: event.target.value } }))} style={appFieldStyle} />
              </label>
            </div>

            <div style={editorSectionStyle}>
              <SectionHeading number="5" title="Dictamen final" />
              <TextInput label="Dictamen final" value={draftContent.finalOpinion.decision} onChange={(value) => updateDraft((content) => ({ ...content, finalOpinion: { ...content.finalOpinion, decision: value } }))} />
              <TextArea label="Razonamiento" value={draftContent.finalOpinion.rationale} onChange={(value) => updateDraft((content) => ({ ...content, finalOpinion: { ...content.finalOpinion, rationale: value } }))} />
            </div>

            <div style={editorSectionStyle}>
              <SectionHeading number="6" title="Anexos" />
              <h4 style={annexTitleStyle}>a. Matriz de auditoria</h4>
              <div style={tableWrapperStyle}>
                <table style={{ ...appTableStyle, minWidth: 620 }}>
                  <thead>
                    <tr>
                      <th style={appTableHeaderStyle}>Requisito</th>
                      <th style={appTableHeaderStyle}>Estado</th>
                      <th style={appTableHeaderStyle}>Evidencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draftContent.annexes.auditMatrix.slice(0, 12).map((row) => (
                      <tr key={row.requirementId}>
                        <td style={appTableCellStyle}>{row.requirement}</td>
                        <td style={appTableCellStyle}>{row.status}</td>
                        <td style={appTableCellStyle}>{row.evidence}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h4 style={annexTitleStyle}>b. KPIs</h4>
              <div style={kpiAnnexStyle}>
                <ScoreInput label="Compliance Score" value={draftContent.annexes.kpis.complianceScore} onChange={(value) => updateDraft((content) => syncKpi(content, "complianceScore", value))} />
                <ScoreInput label="Risk Score" value={draftContent.annexes.kpis.riskScore} onChange={(value) => updateDraft((content) => syncKpi(content, "riskScore", value))} />
                <ScoreInput label="Confidence Score" value={draftContent.annexes.kpis.confidenceScore} onChange={(value) => updateDraft((content) => syncKpi(content, "confidenceScore", value))} />
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label style={labelStyle}>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} style={appFieldStyle} />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label style={labelStyle}>
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} style={appFieldStyle} />
    </label>
  );
}

function ScoreInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label style={labelStyle}>
      {label}
      <input type="number" min={0} max={100} value={value} onChange={(event) => onChange(Number(event.target.value))} style={appFieldStyle} />
    </label>
  );
}

function EditableCard({
  label,
  value,
  multiline = false,
  prominent = false,
  onChange,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  prominent?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label style={prominent ? prominentEditableCardStyle : editableCardStyle}>
      <span style={readOnlyLabelStyle}>{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={prominent ? 4 : 3}
          style={prominent ? prominentEditableCardTextareaStyle : editableCardTextareaStyle}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={editableCardInputStyle}
        />
      )}
    </label>
  );
}

function SectionHeading({ number, title }: { number: string; title: string }) {
  return (
    <div style={sectionHeadingStyle}>
      <span style={sectionNumberStyle}>{number}</span>
      <h3 style={subsectionTitleStyle}>{title}</h3>
    </div>
  );
}

function ReadOnlyGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <div style={readOnlyGridStyle}>
      {items.map(([label, value]) => (
        <div key={label} style={readOnlyItemStyle}>
          <span style={readOnlyLabelStyle}>{label}</span>
          <strong style={readOnlyValueStyle}>{value || "Sin datos"}</strong>
        </div>
      ))}
    </div>
  );
}

function syncKpi(content: ReportContent, key: keyof ReportContent["annexes"]["kpis"], value: number) {
  const score = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  return {
    ...content,
    executiveResult: { ...content.executiveResult, [key]: score },
    annexes: { ...content.annexes, kpis: { ...content.annexes.kpis, [key]: score } },
  };
}

function cloneContent(content: ReportContent) {
  return JSON.parse(JSON.stringify(content)) as ReportContent;
}

function splitLines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
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
    const res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const message = data?.error || `HTTP ${res.status}`;
      return { error: `${url}: ${message}` };
    }

    return { data: data as T };
  } catch (error) {
    return {
      error: `${url}: ${error instanceof Error ? error.message : "No se pudo completar la peticion"}`,
    };
  }
}

const pageStyle: React.CSSProperties = {
  ...appPageStyle,
  display: "grid",
  gap: 18,
  padding: "24px clamp(16px, 3vw, 32px) 40px",
};

const heroStyle: React.CSSProperties = {
  ...appHeroStyle,
  margin: "0 auto",
  maxWidth: 1120,
  width: "100%",
};

const stackStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
  margin: "0 auto",
  maxWidth: 1120,
  width: "100%",
};

const panelStyle: React.CSSProperties = {
  ...appPanelStyle,
  boxSizing: "border-box",
  display: "grid",
  gap: 14,
  margin: "0 auto",
  maxWidth: 1120,
  padding: 18,
  width: "100%",
};

const sectionTitleStyle: React.CSSProperties = {
  color: "#002a4e",
  fontSize: 19,
  fontWeight: 600,
  margin: 0,
};

const sectionDescriptionStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 14,
  lineHeight: 1.45,
  margin: "6px 0 0",
};

const subsectionTitleStyle: React.CSSProperties = {
  color: "#002a4e",
  fontSize: 16,
  fontWeight: 600,
  margin: 0,
};

const sectionHeadingStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 10,
};

const sectionNumberStyle: React.CSSProperties = {
  alignItems: "center",
  background: "#eef4ff",
  border: "1px solid #bfdbfe",
  borderRadius: 8,
  color: "#0025df",
  display: "inline-flex",
  flexShrink: 0,
  fontSize: 13,
  fontWeight: 700,
  height: 30,
  justifyContent: "center",
  width: 30,
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

const secondaryLinkStyle: React.CSSProperties = {
  ...appSecondaryButtonStyle,
  alignItems: "center",
  display: "inline-flex",
  textDecoration: "none",
};

const previewHeaderStyle: React.CSSProperties = {
  alignItems: "start",
  display: "grid",
  gap: 12,
};

const editorStackStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const editorSectionStyle: React.CSSProperties = {
  borderTop: "1px solid #dbe3f1",
  display: "grid",
  gap: 14,
  minWidth: 0,
  paddingTop: 18,
};

const readOnlyGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const editableCardGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
};

const readOnlyItemStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  display: "grid",
  gap: 4,
  padding: 12,
};

const editableCardStyle: React.CSSProperties = {
  ...readOnlyItemStyle,
  cursor: "text",
};

const prominentEditableCardStyle: React.CSSProperties = {
  ...editableCardStyle,
  gap: 8,
  padding: 14,
};

const readOnlyLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 600,
};

const readOnlyValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 14,
  lineHeight: 1.35,
};

const editableCardInputStyle: React.CSSProperties = {
  background: "transparent",
  border: 0,
  color: "#0f172a",
  font: "inherit",
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.35,
  outline: "none",
  padding: 0,
  width: "100%",
};

const editableCardTextareaStyle: React.CSSProperties = {
  ...editableCardInputStyle,
  minHeight: 70,
  resize: "vertical",
};

const prominentEditableCardTextareaStyle: React.CSSProperties = {
  ...editableCardTextareaStyle,
  minHeight: 96,
};

const annexTitleStyle: React.CSSProperties = {
  color: "#334155",
  fontSize: 14,
  fontWeight: 700,
  margin: "6px 0 0",
};

const kpiAnnexStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "1fr",
};
