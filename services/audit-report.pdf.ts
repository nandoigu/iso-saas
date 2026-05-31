import { jsPDF } from "jspdf";
import type { AuditReportContent } from "@/services/audit-report.types";

const page = {
  margin: 16,
  width: 210,
  height: 297,
  bottom: 276,
};

export async function generateAuditReportPdf(content: AuditReportContent) {
  const doc = new jsPDF({ format: "a4", orientation: "portrait", unit: "mm" });
  const cursor = { y: page.margin };

  title(doc, cursor, "BAOS", 20);
  title(doc, cursor, "Informe de Auditoria ISO 19650", 14);

  section(doc, cursor, "1. Datos generales");
  kv(doc, cursor, "Organizacion", content.cover.organizationName);
  kv(doc, cursor, "Numero auditoria", content.cover.auditNumber);
  kv(doc, cursor, "Numero informe", content.cover.reportNumber);
  kv(doc, cursor, "Tipo auditoria", content.cover.auditType);
  kv(doc, cursor, "Norma aplicable", content.cover.standards.join(", "));
  kv(doc, cursor, "Fechas auditoria", content.cover.auditDates);
  kv(doc, cursor, "Fecha informe", content.cover.reportDate);
  kv(doc, cursor, "Proyecto", content.generalData.projectName);
  kv(doc, cursor, "Codigo", content.generalData.projectCode);
  kv(doc, cursor, "Organizacion", content.generalData.organizationName);
  kv(doc, cursor, "Direccion", content.generalData.organizationAddress);
  kv(doc, cursor, "Representante", content.generalData.organizationRepresentative);
  kv(doc, cursor, "Auditor", `${content.generalData.leadAuditorName} (${content.generalData.leadAuditorInitials})`);
  kv(doc, cursor, "Alcance de la certificacion", content.generalData.certificationScope);

  section(doc, cursor, "2. Criterios de Auditoria");
  content.auditCriteria.forEach((criterion) => paragraph(doc, cursor, `- ${criterion}`));

  section(doc, cursor, "3. Resumen ejecutivo");
  kv(doc, cursor, "Cuestiones generales", content.executiveSummary.generalIssues);
  kv(doc, cursor, "Adecuacion del alcance", content.executiveSummary.scopeAdequacy);
  kv(doc, cursor, "Objetivos de auditoria", content.executiveSummary.auditObjectives);
  kv(doc, cursor, "Contexto de la auditoria", content.executiveSummary.auditContext);
  kv(doc, cursor, "Consideraciones generales del auditor", content.executiveSummary.auditorGeneralConsiderations);
  kv(doc, cursor, "Puntos fuertes", content.executiveSummary.strengths);
  kv(doc, cursor, "Debilidades y oportunidades de mejora", content.executiveSummary.weaknessesAndImprovements);
  kv(doc, cursor, "Observaciones", content.executiveSummary.observations);

  subsection(doc, cursor, "No conformidades");
  rows(
    doc,
    cursor,
    content.executiveSummary.nonConformities.map((row) => [
      row.itemCode,
      formatStatus(row.status),
      row.reason || "Pendiente de completar por el auditor",
    ])
  );

  section(doc, cursor, "4. Resultado ejecutivo");
  rows(doc, cursor, [
    ["Cumplimiento ponderado", `${content.annexes.kpis.weightedComplianceScore}/100`],
    ["Requisitos parciales", String(content.annexes.kpis.partialRequirements)],
    ["Requisitos no conformes", String(content.annexes.kpis.nonCompliantRequirements)],
    ["Estado", content.executiveResult.status],
  ]);

  section(doc, cursor, "5. Dictamen final");
  kv(doc, cursor, "Dictamen", content.finalOpinion.decision);
  paragraph(doc, cursor, content.finalOpinion.rationale);

  section(doc, cursor, "6. Anexos");
  subsection(doc, cursor, "Matriz de auditoria");
  rows(doc, cursor, content.annexes.auditMatrix.map((row) => [row.requirement, row.status, row.evidence]));
  subsection(doc, cursor, "Indicadores auditables");
  rows(doc, cursor, [
    ["Requisitos auditados", String(content.annexes.kpis.totalRequirements)],
    ["Requisitos conformes", String(content.annexes.kpis.compliantRequirements)],
    ["Requisitos parciales", String(content.annexes.kpis.partialRequirements)],
    ["Requisitos no conformes", String(content.annexes.kpis.nonCompliantRequirements)],
    ["Evidencias registradas", String(content.annexes.kpis.evidenceCount)],
    ["Cumplimiento ponderado", `${content.annexes.kpis.weightedComplianceScore}/100`],
  ]);

  return Buffer.from(doc.output("arraybuffer"));
}

function title(doc: jsPDF, cursor: { y: number }, text: string, size: number) {
  ensureSpace(doc, cursor, 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(size);
  doc.setTextColor("#002a4e");
  doc.text(text, page.width / 2, cursor.y, { align: "center" });
  cursor.y += size === 20 ? 10 : 8;
}

function section(doc: jsPDF, cursor: { y: number }, text: string) {
  ensureSpace(doc, cursor, 18);
  cursor.y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor("#002a4e");
  doc.text(text, page.margin, cursor.y);
  cursor.y += 7;
}

function subsection(doc: jsPDF, cursor: { y: number }, text: string) {
  ensureSpace(doc, cursor, 14);
  cursor.y += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor("#0f172a");
  doc.text(text, page.margin, cursor.y);
  cursor.y += 6;
}

function kv(doc: jsPDF, cursor: { y: number }, label: string, value: string) {
  paragraph(doc, cursor, `${label}: ${value || "Sin datos"}`);
}

function paragraph(doc: jsPDF, cursor: { y: number }, text: string) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#0f172a");

  const lines = doc.splitTextToSize(String(text || "Sin datos"), page.width - page.margin * 2);
  ensureSpace(doc, cursor, lines.length * 5 + 3);
  doc.text(lines, page.margin, cursor.y);
  cursor.y += lines.length * 5 + 3;
}

function rows(doc: jsPDF, cursor: { y: number }, rowsData: string[][]) {
  const data = rowsData.length ? rowsData : [["Sin datos"]];

  data.forEach((row) => {
    paragraph(doc, cursor, row.map((cell) => String(cell || "-")).join(" | "));
  });
}

function formatStatus(status: string) {
  if (status === "parcial") return "Parcial";
  if (status === "no_conforme") return "No conforme";
  return status || "Sin estado";
}

function ensureSpace(doc: jsPDF, cursor: { y: number }, height: number) {
  if (cursor.y + height > page.bottom) {
    doc.addPage();
    cursor.y = page.margin;
  }
}
