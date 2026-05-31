import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import type { AuditReportContent } from "@/services/audit-report.types";

const page = {
  margin: 16,
  width: 210,
  bottom: 278,
};

const colors = {
  navy: "#002a4e",
  blue: "#0025df",
  text: "#0f172a",
  muted: "#64748b",
  line: "#dbe3f1",
  soft: "#f4f6fc",
  softBlue: "#eef4ff",
};

type Cursor = { y: number };

export async function generateAuditReportPdf(content: AuditReportContent) {
  const doc = new jsPDF({ format: "a4", orientation: "portrait", unit: "mm" });
  const cursor = { y: page.margin };

  cover(doc, content);
  doc.addPage();
  cursor.y = page.margin;

  section(doc, cursor, "1. Datos generales");
  keyValueTable(doc, cursor, [
    ["Organizacion", content.cover.organizationName],
    ["Numero auditoria", content.cover.auditNumber],
    ["Numero informe", content.cover.reportNumber],
    ["Tipo auditoria", content.cover.auditType],
    ["Norma aplicable", content.cover.standards.join(", ")],
    ["Fechas auditoria", content.cover.auditDates],
    ["Fecha informe", content.cover.reportDate],
    ["Proyecto", content.generalData.projectName],
    ["Codigo proyecto", content.generalData.projectCode],
    ["Representante", content.generalData.organizationRepresentative],
    ["Auditor jefe", `${content.generalData.leadAuditorName} (${content.generalData.leadAuditorInitials})`],
  ]);
  narrativeBox(doc, cursor, "Alcance de la certificacion", content.generalData.certificationScope);

  section(doc, cursor, "2. Criterios de auditoria");
  bulletList(doc, cursor, content.auditCriteria);

  section(doc, cursor, "3. Resumen ejecutivo");
  proseGroup(doc, cursor, [
    ["Cuestiones generales", content.executiveSummary.generalIssues],
    ["Adecuacion del alcance", content.executiveSummary.scopeAdequacy],
    ["Objetivos de auditoria", content.executiveSummary.auditObjectives],
    ["Contexto de la auditoria", content.executiveSummary.auditContext],
    ["Consideraciones generales del auditor", content.executiveSummary.auditorGeneralConsiderations],
    ["Puntos fuertes", content.executiveSummary.strengths],
    ["Debilidades y oportunidades de mejora", content.executiveSummary.weaknessesAndImprovements],
    ["Observaciones", content.executiveSummary.observations],
  ]);

  subsection(doc, cursor, "No conformidades");
  table(doc, cursor, {
    head: [["Requerimiento", "Estado", "Razon de la valoracion"]],
    body: content.executiveSummary.nonConformities.map((row) => [
      row.itemCode,
      formatStatus(row.status),
      row.reason || "Pendiente de completar por el auditor",
    ]),
    widths: { 0: 34, 1: 28, 2: 116 },
  });

  section(doc, cursor, "4. Resultado ejecutivo");
  keyValueTable(doc, cursor, [
    ["Estado global", content.executiveResult.status],
    ["Cumplimiento ponderado", `${content.annexes.kpis.weightedComplianceScore}/100`],
    ["Requisitos parciales", String(content.annexes.kpis.partialRequirements)],
    ["Requisitos no conformes", String(content.annexes.kpis.nonCompliantRequirements)],
  ]);

  section(doc, cursor, "5. Dictamen final");
  decisionBox(doc, cursor, content.finalOpinion.decision);
  paragraph(doc, cursor, content.finalOpinion.rationale);

  section(doc, cursor, "6. Anexos");
  subsection(doc, cursor, "a. Matriz de auditoria");
  table(doc, cursor, {
    head: [["Requisito", "Estado", "Evidencia"]],
    body: content.annexes.auditMatrix.map((row) => [row.requirement, row.status, row.evidence]),
    widths: { 0: 76, 1: 28, 2: 74 },
  });

  subsection(doc, cursor, "b. Indicadores auditables");
  keyValueTable(doc, cursor, [
    ["Requisitos auditados", String(content.annexes.kpis.totalRequirements)],
    ["Requisitos conformes", String(content.annexes.kpis.compliantRequirements)],
    ["Requisitos parciales", String(content.annexes.kpis.partialRequirements)],
    ["Requisitos no conformes", String(content.annexes.kpis.nonCompliantRequirements)],
    ["Evidencias registradas", String(content.annexes.kpis.evidenceCount)],
    ["Cumplimiento ponderado", `${content.annexes.kpis.weightedComplianceScore}/100`],
  ]);

  addFooters(doc, content.cover.reportNumber);
  return Buffer.from(doc.output("arraybuffer"));
}

function cover(doc: jsPDF, content: AuditReportContent) {
  doc.setFillColor(colors.soft);
  doc.rect(0, 0, page.width, 297, "F");
  doc.setFillColor(colors.navy);
  doc.rect(0, 0, page.width, 34, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor("#ffffff");
  doc.text("BAOS", page.margin, 20);

  doc.setTextColor(colors.navy);
  doc.setFontSize(24);
  doc.text("Informe de Auditoria", page.margin, 62);
  doc.setFontSize(18);
  doc.text("ISO 19650", page.margin, 73);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(colors.muted);
  doc.text("Documento generado desde la matriz de auditoria del proyecto.", page.margin, 84);

  autoTable(doc, {
    startY: 104,
    margin: { left: page.margin, right: page.margin },
    theme: "plain",
    body: [
      ["Organizacion", content.cover.organizationName],
      ["Numero auditoria", content.cover.auditNumber],
      ["Numero informe", content.cover.reportNumber],
      ["Tipo auditoria", content.cover.auditType],
      ["Norma aplicable", content.cover.standards.join(", ")],
      ["Fechas auditoria", content.cover.auditDates],
      ["Fecha informe", content.cover.reportDate],
    ],
    styles: { font: "helvetica", fontSize: 10, cellPadding: 3.2, lineColor: colors.line },
    columnStyles: {
      0: { fontStyle: "bold", textColor: colors.muted, cellWidth: 48 },
      1: { textColor: colors.text },
    },
    alternateRowStyles: { fillColor: "#ffffff" },
  });
}

function section(doc: jsPDF, cursor: Cursor, text: string) {
  ensureSpace(doc, cursor, 18);
  cursor.y += cursor.y === page.margin ? 0 : 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(colors.navy);
  doc.text(text, page.margin, cursor.y);
  cursor.y += 3;
  doc.setDrawColor(colors.line);
  doc.line(page.margin, cursor.y, page.width - page.margin, cursor.y);
  cursor.y += 7;
}

function subsection(doc: jsPDF, cursor: Cursor, text: string) {
  ensureSpace(doc, cursor, 12);
  cursor.y += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(colors.text);
  doc.text(text, page.margin, cursor.y);
  cursor.y += 5;
}

function keyValueTable(doc: jsPDF, cursor: Cursor, rows: Array<[string, string]>) {
  table(doc, cursor, {
    body: rows,
    widths: { 0: 48, 1: 130 },
    plain: true,
  });
}

function narrativeBox(doc: jsPDF, cursor: Cursor, title: string, text: string) {
  ensureSpace(doc, cursor, 28);
  doc.setFillColor(colors.softBlue);
  doc.setDrawColor("#bfdbfe");
  doc.roundedRect(page.margin, cursor.y, page.width - page.margin * 2, 22, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(colors.muted);
  doc.text(title, page.margin + 4, cursor.y + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.text);
  const lines = doc.splitTextToSize(text || "Sin datos", page.width - page.margin * 2 - 8);
  doc.text(lines.slice(0, 3), page.margin + 4, cursor.y + 12);
  cursor.y += 28;
}

function proseGroup(doc: jsPDF, cursor: Cursor, rows: Array<[string, string]>) {
  rows.forEach(([title, text]) => {
    subsection(doc, cursor, title);
    paragraph(doc, cursor, text);
  });
}

function decisionBox(doc: jsPDF, cursor: Cursor, text: string) {
  ensureSpace(doc, cursor, 18);
  doc.setFillColor(colors.softBlue);
  doc.setDrawColor("#bfdbfe");
  doc.roundedRect(page.margin, cursor.y, page.width - page.margin * 2, 14, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(colors.navy);
  doc.text(text || "Sin dictamen", page.margin + 4, cursor.y + 9);
  cursor.y += 20;
}

function bulletList(doc: jsPDF, cursor: Cursor, items: string[]) {
  const list = items.length ? items : ["Sin datos"];
  list.forEach((item) => paragraph(doc, cursor, `- ${item}`));
}

function paragraph(doc: jsPDF, cursor: Cursor, text: string) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(colors.text);
  const lines = doc.splitTextToSize(String(text || "Sin datos"), page.width - page.margin * 2);
  ensureSpace(doc, cursor, lines.length * 4.6 + 2);
  doc.text(lines, page.margin, cursor.y);
  cursor.y += lines.length * 4.6 + 2;
}

function table(
  doc: jsPDF,
  cursor: Cursor,
  {
    head,
    body,
    widths,
    plain = false,
  }: {
    head?: RowInput[];
    body: RowInput[];
    widths: Record<number, number>;
    plain?: boolean;
  }
) {
  autoTable(doc, {
    startY: cursor.y,
    head,
    body: body.length ? body : [["Sin datos"]],
    margin: { left: page.margin, right: page.margin },
    theme: plain ? "plain" : "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.6,
      cellPadding: 2.4,
      overflow: "linebreak",
      lineColor: colors.line,
      lineWidth: plain ? 0.1 : 0.2,
      textColor: colors.text,
      valign: "middle",
    },
    headStyles: {
      fillColor: colors.navy,
      textColor: "#ffffff",
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: "#f8fafc" },
    columnStyles: Object.fromEntries(
      Object.entries(widths).map(([key, width]) => [key, { cellWidth: width }])
    ),
    didDrawPage: () => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(colors.muted);
    },
  });
  cursor.y = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
    ? (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7
    : cursor.y + 7;
}

function addFooters(doc: jsPDF, reportNumber: string) {
  const totalPages = doc.getNumberOfPages();

  for (let index = 1; index <= totalPages; index += 1) {
    doc.setPage(index);
    doc.setDrawColor(colors.line);
    doc.line(page.margin, 284, page.width - page.margin, 284);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(colors.muted);
    doc.text(reportNumber, page.margin, 290);
    doc.text(`Pagina ${index} de ${totalPages}`, page.width - page.margin, 290, { align: "right" });
  }
}

function formatStatus(status: string) {
  if (status === "parcial") return "Parcial";
  if (status === "no_conforme") return "No conforme";
  return status || "Sin estado";
}

function ensureSpace(doc: jsPDF, cursor: Cursor, height: number) {
  if (cursor.y + height > page.bottom) {
    doc.addPage();
    cursor.y = page.margin;
  }
}
