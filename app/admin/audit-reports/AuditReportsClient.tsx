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

type ReportNonConformity = {
  requirementId: string;
  itemCode: string;
  status: string;
  reason: string;
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
  executiveSummary: {
    generalIssues: string;
    scopeAdequacy: string;
    auditObjectives: string;
    auditContext: string;
    auditorGeneralConsiderations: string;
    strengths: string;
    weaknessesAndImprovements: string;
    observations: string;
    nonConformities: ReportNonConformity[];
  };
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
      totalRequirements: number;
      compliantRequirements: number;
      partialRequirements: number;
      nonCompliantRequirements: number;
      evidenceCount: number;
      weightedComplianceScore: number;
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
type SummaryTextKey = Exclude<keyof ReportContent["executiveSummary"], "nonConformities">;
const summaryFields: Array<{ key: SummaryTextKey; label: string }> = [
  { key: "generalIssues", label: "Cuestiones generales" },
  { key: "scopeAdequacy", label: "Adecuacion del alcance" },
  { key: "auditObjectives", label: "Objetivos de auditoria" },
  { key: "auditContext", label: "Contexto de la auditoria" },
  { key: "auditorGeneralConsiderations", label: "Consideraciones generales del auditor" },
  { key: "strengths", label: "Puntos fuertes" },
  { key: "weaknessesAndImprovements", label: "Debilidades y oportunidades de mejora" },
  { key: "observations", label: "Observaciones" },
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
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
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

  const deleteReport = async (report: AuditReport) => {
    const confirmed = window.confirm(`Eliminar el informe ${report.reportNumber}? Esta accion no se puede deshacer.`);
    if (!confirmed) return;

    setDeletingReportId(report.id);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/admin/audit-reports/${report.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) throw new Error(data?.error || "No se pudo eliminar el informe.");

      const remainingReports = reports.filter((current) => current.id !== report.id);
      setReports(remainingReports);
      setSelectedReportId((current) =>
        current === report.id ? remainingReports[0]?.id || null : current
      );
      setSuccess(`Informe ${report.reportNumber} eliminado correctamente.`);
      await loadData();
    } catch (deleteError) {
      console.error(deleteError);
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el informe.");
    } finally {
      setDeletingReportId(null);
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
            Genera, revisa, versiona y exporta informes de auditoria desde la matriz del proyecto.
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
          <PanelHeader
            title="Generar informe"
            description="Crea una nueva version base desde los datos actuales del proyecto."
          />
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
            <input value={leadAuditor} onChange={(event) => setLeadAuditor(event.target.value)} style={editableFieldStyle} />
          </label>
          <label style={labelStyle}>
            Alcance de la certificacion
            <textarea value={scope} onChange={(event) => setScope(event.target.value)} rows={4} style={editableFieldStyle} />
          </label>
          <button type="button" onClick={createReport} disabled={saving || loading} style={{ ...appPrimaryButtonStyle, ...getActionStateStyle(saving || loading) }}>
            {saving ? "Procesando..." : "Generar informe"}
          </button>
        </div>

        <div style={panelStyle}>
          <PanelHeader
            title="Informes generados"
            description="Selecciona un informe para revisar su previsualizacion editable."
          />
          <div style={tableWrapperStyle}>
            <table style={{ ...appTableStyle, minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={appTableHeaderStyle}>Informe</th>
                  <th style={appTableHeaderStyle}>Proyecto</th>
                  <th style={appTableHeaderStyle}>Resultado</th>
                  <th style={appTableHeaderStyle}>Estado</th>
                  <th style={appTableHeaderStyle}>Version</th>
                  <th style={appTableHeaderStyle}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id} style={report.id === selectedReport?.id ? selectedTableRowStyle : undefined}>
                    <td style={appTableCellStyle}>{report.reportNumber}</td>
                    <td style={appTableCellStyle}>{report.project?.name || report.auditedOrgName}</td>
                    <td style={appTableCellStyle}><StatusBadge value={report.globalStatus} /></td>
                    <td style={appTableCellStyle}>
                      <EditingStatusBadge isEditing={report.id === selectedReport?.id} />
                    </td>
                    <td style={appTableCellStyle}>v{report.version}</td>
                    <td style={appTableCellStyle}>
                      <div style={actionRowStyle}>
                        <button
                          type="button"
                          onClick={saveDraft}
                          disabled={report.id !== selectedReport?.id || saving || !draftContent}
                          style={{
                            ...smallPrimaryButtonStyle,
                            ...getActionStateStyle(report.id !== selectedReport?.id || saving || !draftContent),
                          }}
                        >
                          Guardar
                        </button>
                        <button type="button" onClick={() => setSelectedReportId(report.id)} style={smallButtonStyle}>
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteReport(report)}
                          disabled={deletingReportId === report.id}
                          style={{ ...smallDangerButtonStyle, ...getActionStateStyle(deletingReportId === report.id) }}
                        >
                          {deletingReportId === report.id ? "Eliminando..." : "Eliminar"}
                        </button>
                        <a href={`/api/admin/audit-reports/${report.id}/export/docx`} style={smallLinkStyle}>DOCX</a>
                        <a href={`/api/admin/audit-reports/${report.id}/export/pdf`} style={smallLinkStyle}>PDF</a>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && reports.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ ...appTableCellStyle, textAlign: "center", color: "#64748b" }}>
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
                Revisa el contenido en orden documental. Los anexos quedan al final del informe.
              </p>
              <div style={metaRowStyle}>
                <span style={metaChipStyle}>Version v{selectedReport.version}</span>
                <StatusBadge value={draftContent.executiveResult.status} />
                <span style={metaChipStyle}>Cumplimiento {draftContent.annexes.kpis.weightedComplianceScore}/100</span>
              </div>
            </div>
            <div style={previewActionsStyle}>
              <button type="button" onClick={saveDraft} disabled={saving} style={{ ...appPrimaryButtonStyle, ...getActionStateStyle(saving) }}>
                Guardar version
              </button>
              <button type="button" onClick={regenerate} disabled={saving} style={{ ...appSecondaryButtonStyle, ...getActionStateStyle(saving) }}>
                Regenerar base
              </button>
              <span style={buttonGroupDividerStyle} />
              <a href={`/api/admin/audit-reports/${selectedReport.id}/export/docx`} style={secondaryLinkStyle}>DOCX</a>
              <a href={`/api/admin/audit-reports/${selectedReport.id}/export/pdf`} style={secondaryLinkStyle}>PDF</a>
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
              <NonConformitiesEditor
                items={draftContent.executiveSummary.nonConformities}
                onChange={(items) =>
                  updateDraft((content) => ({
                    ...content,
                    executiveSummary: { ...content.executiveSummary, nonConformities: items },
                  }))
                }
              />
            </div>

            <div style={editorSectionStyle}>
              <SectionHeading number="4" title="Resultado ejecutivo" />
              <label style={labelStyle}>
                Estado
                <input value={draftContent.executiveResult.status} onChange={(event) => updateDraft((content) => ({ ...content, executiveResult: { ...content.executiveResult, status: event.target.value } }))} style={editableFieldStyle} />
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
                    {draftContent.annexes.auditMatrix.map((row) => (
                      <tr key={row.requirementId}>
                        <td style={appTableCellStyle}>{row.requirement}</td>
                        <td style={appTableCellStyle}>{row.status}</td>
                        <td style={appTableCellStyle}>{row.evidence}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h4 style={annexTitleStyle}>b. Indicadores auditables</h4>
              <AuditIndicators indicators={draftContent.annexes.kpis} />
            </div>
          </div>
          <div style={bottomActionBarStyle}>
            <button type="button" onClick={saveDraft} disabled={saving} style={{ ...appPrimaryButtonStyle, ...getActionStateStyle(saving) }}>
              Guardar version
            </button>
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
      <input value={value} onChange={(event) => onChange(event.target.value)} style={editableFieldStyle} />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label style={labelStyle}>
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} style={editableFieldStyle} />
    </label>
  );
}

function PanelHeader({ title, description }: { title: string; description: string }) {
  return (
    <div style={panelHeaderStyle}>
      <h2 style={sectionTitleStyle}>{title}</h2>
      <p style={sectionDescriptionStyle}>{description}</p>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const tone = normalized.includes("no conforme")
    ? statusBadgeDangerStyle
    : normalized.includes("observacion") || normalized.includes("accion")
      ? statusBadgeWarningStyle
      : statusBadgeSuccessStyle;

  return <span style={{ ...statusBadgeStyle, ...tone }}>{value || "Sin estado"}</span>;
}

function EditingStatusBadge({ isEditing }: { isEditing: boolean }) {
  return (
    <span
      style={{
        ...statusBadgeStyle,
        ...(isEditing ? editingStatusBadgeStyle : savedStatusBadgeStyle),
      }}
    >
      {isEditing ? "Editando" : "Guardado"}
    </span>
  );
}

function AuditIndicators({ indicators }: { indicators: ReportContent["annexes"]["kpis"] }) {
  return (
    <div style={indicatorGridStyle}>
      <div style={featuredIndicatorStyle}>
        <span style={readOnlyLabelStyle}>Cumplimiento ponderado</span>
        <strong style={featuredIndicatorValueStyle}>{indicators.weightedComplianceScore}/100</strong>
      </div>
      {[
        ["Requisitos auditados", indicators.totalRequirements],
        ["Conformes", indicators.compliantRequirements],
        ["Parciales", indicators.partialRequirements],
        ["No conformes", indicators.nonCompliantRequirements],
        ["Evidencias", indicators.evidenceCount],
      ].map(([label, value]) => (
        <div key={label} style={indicatorItemStyle}>
          <span style={readOnlyLabelStyle}>{label}</span>
          <strong style={indicatorValueStyle}>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function NonConformitiesEditor({
  items,
  onChange,
}: {
  items: ReportNonConformity[];
  onChange: (items: ReportNonConformity[]) => void;
}) {
  return (
    <div style={nonConformitiesStyle}>
      <h4 style={fieldGroupTitleStyle}>No conformidades</h4>
      {items.length === 0 ? (
        <div style={emptyInlineStyle}>No hay requisitos con estado No conforme o Parcial.</div>
      ) : (
        items.map((item, index) => (
          <div key={`${item.requirementId}-${index}`} style={nonConformityItemStyle}>
            <div style={nonConformityMetaStyle}>
              <span style={readOnlyLabelStyle}>Requerimiento</span>
              <strong style={nonConformityCodeStyle}>{item.itemCode}</strong>
              <span style={statusPillStyle}>{getRequirementStatusLabel(item.status)}</span>
            </div>
            <label style={nonConformityReasonStyle}>
              Razon de la valoracion
              <textarea
                value={item.reason}
                onChange={(event) => {
                  const nextItems = [...items];
                  nextItems[index] = { ...item, reason: event.target.value };
                  onChange(nextItems);
                }}
                rows={4}
                style={editableFieldStyle}
              />
            </label>
          </div>
        ))
      )}
    </div>
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

function cloneContent(content: ReportContent) {
  return JSON.parse(JSON.stringify(content)) as ReportContent;
}

function splitLines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function getRequirementStatusLabel(status: string) {
  if (status === "parcial") return "Parcial";
  if (status === "no_conforme") return "No conforme";
  return status || "Sin estado";
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
  gap: 16,
  margin: "0 auto",
  maxWidth: 1120,
  padding: 20,
  width: "100%",
};

const panelHeaderStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
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

const editableFieldStyle: React.CSSProperties = {
  ...appFieldStyle,
  fontWeight: 400,
};

const fieldGroupTitleStyle: React.CSSProperties = {
  color: "#1e293b",
  fontSize: 14,
  fontWeight: 700,
  margin: 0,
};

const nonConformitiesStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const nonConformityItemStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #dbe3f1",
  borderRadius: 8,
  display: "grid",
  gap: 12,
  padding: 12,
};

const nonConformityMetaStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const nonConformityCodeStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 15,
  fontWeight: 700,
};

const statusPillStyle: React.CSSProperties = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  borderRadius: 999,
  color: "#9a3412",
  fontSize: 12,
  fontWeight: 600,
  padding: "4px 8px",
};

const nonConformityReasonStyle: React.CSSProperties = {
  ...labelStyle,
  fontWeight: 600,
};

const emptyInlineStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  borderRadius: 8,
  color: "#64748b",
  padding: 12,
};

const tableWrapperStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
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

const smallPrimaryButtonStyle: React.CSSProperties = {
  ...appPrimaryButtonStyle,
  minHeight: 32,
  padding: "5px 9px",
};

const smallLinkStyle: React.CSSProperties = {
  ...smallButtonStyle,
  color: "#0f172a",
  textDecoration: "none",
};

const smallDangerButtonStyle: React.CSSProperties = {
  ...smallButtonStyle,
  background: "#fffafa",
  borderColor: "#fecaca",
  color: "#b91c1c",
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

const previewActionsStyle: React.CSSProperties = {
  ...actionRowStyle,
  alignItems: "center",
};

const buttonGroupDividerStyle: React.CSSProperties = {
  background: "#e2e8f0",
  display: "inline-flex",
  height: 28,
  width: 1,
};

const metaRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 10,
};

const metaChipStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 999,
  color: "#334155",
  display: "inline-flex",
  fontSize: 12,
  fontWeight: 600,
  padding: "5px 9px",
};

const statusBadgeStyle: React.CSSProperties = {
  borderRadius: 999,
  display: "inline-flex",
  fontSize: 12,
  fontWeight: 600,
  padding: "5px 9px",
};

const statusBadgeSuccessStyle: React.CSSProperties = {
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  color: "#166534",
};

const statusBadgeWarningStyle: React.CSSProperties = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
};

const statusBadgeDangerStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
};

const editingStatusBadgeStyle: React.CSSProperties = {
  background: "#eef4ff",
  border: "1px solid #bfdbfe",
  color: "#0025df",
};

const savedStatusBadgeStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #dbe3f1",
  color: "#475569",
};

const editorStackStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const bottomActionBarStyle: React.CSSProperties = {
  borderTop: "1px solid #dbe3f1",
  display: "flex",
  justifyContent: "flex-end",
  paddingTop: 16,
};

const editorSectionStyle: React.CSSProperties = {
  borderTop: "1px solid #dbe3f1",
  display: "grid",
  gap: 14,
  minWidth: 0,
  paddingTop: 18,
};

const selectedTableRowStyle: React.CSSProperties = {
  background: "#f8fafc",
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

const indicatorGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
};

const featuredIndicatorStyle: React.CSSProperties = {
  ...readOnlyItemStyle,
  background: "#eef4ff",
  borderColor: "#bfdbfe",
  gridColumn: "1 / -1",
};

const indicatorItemStyle: React.CSSProperties = {
  ...readOnlyItemStyle,
};

const featuredIndicatorValueStyle: React.CSSProperties = {
  color: "#002a4e",
  fontSize: 24,
  fontWeight: 700,
};

const indicatorValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 700,
};

const editableCardStyle: React.CSSProperties = {
  ...readOnlyItemStyle,
  cursor: "text",
  fontWeight: 400,
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
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: 400,
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
