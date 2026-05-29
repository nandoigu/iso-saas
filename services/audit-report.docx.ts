import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { AuditReportContent } from "@/services/audit-report.types";

export async function generateAuditReportDocx(content: AuditReportContent) {
  const doc = new Document({
    creator: "BAOS",
    description: "Informe basico de auditoria ISO 19650",
    title: content.cover.reportNumber,
    sections: [
      {
        properties: {},
        children: [
          heading("1. Datos generales"),
          ...generalData(content),
          kv("Proyecto", content.generalData.projectName),
          kv("Codigo", content.generalData.projectCode),
          kv("Organizacion", content.generalData.organizationName),
          kv("Direccion", content.generalData.organizationAddress),
          kv("Representante", content.generalData.organizationRepresentative),
          kv("Auditor", `${content.generalData.leadAuditorName} (${content.generalData.leadAuditorInitials})`),
          kv("Alcance de la certificacion", content.generalData.certificationScope),
          heading("2. Criterios de Auditoria"),
          ...content.auditCriteria.map((criterion) => bullet(criterion)),
          heading("3. Resumen ejecutivo"),
          subsection("Cuestiones generales", content.executiveSummary.generalIssues),
          subsection("Adecuacion del alcance", content.executiveSummary.scopeAdequacy),
          subsection("Objetivos de auditoria", content.executiveSummary.auditObjectives),
          subsection("Contexto de la auditoria", content.executiveSummary.auditContext),
          subsection(
            "Consideraciones generales del auditor",
            content.executiveSummary.auditorGeneralConsiderations
          ),
          subsection("Puntos fuertes", content.executiveSummary.strengths),
          subsection(
            "Debilidades y oportunidades de mejora",
            content.executiveSummary.weaknessesAndImprovements
          ),
          subsection("Observaciones", content.executiveSummary.observations),
          heading("No conformidades", 3),
          table(
            ["Requerimiento", "Estado", "Razon de la valoracion"],
            content.executiveSummary.nonConformities.map((row) => [
              row.itemCode,
              formatStatus(row.status),
              row.reason || "Pendiente de completar por el auditor",
            ])
          ),
          heading("4. Resultado ejecutivo"),
          table(["Indicador", "Resultado"], [
            ["Cumplimiento ponderado", `${content.annexes.kpis.weightedComplianceScore}/100`],
            ["Requisitos parciales", String(content.annexes.kpis.partialRequirements)],
            ["Requisitos no conformes", String(content.annexes.kpis.nonCompliantRequirements)],
            ["Estado", content.executiveResult.status],
          ]),
          heading("5. Dictamen final"),
          kv("Dictamen", content.finalOpinion.decision),
          paragraph(content.finalOpinion.rationale),
          heading("6. Anexos"),
          heading("Matriz de auditoria", 3),
          table(
            ["Requisito", "Estado", "Evidencia"],
            content.annexes.auditMatrix.map((row) => [row.requirement, row.status, row.evidence])
          ),
          heading("Indicadores auditables", 3),
          table(["Indicador", "Valor"], [
            ["Requisitos auditados", String(content.annexes.kpis.totalRequirements)],
            ["Requisitos conformes", String(content.annexes.kpis.compliantRequirements)],
            ["Requisitos parciales", String(content.annexes.kpis.partialRequirements)],
            ["Requisitos no conformes", String(content.annexes.kpis.nonCompliantRequirements)],
            ["Evidencias registradas", String(content.annexes.kpis.evidenceCount)],
            ["Cumplimiento ponderado", `${content.annexes.kpis.weightedComplianceScore}/100`],
          ]),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

function generalData(content: AuditReportContent) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
      children: [new TextRun({ text: "BAOS", bold: true, size: 44, color: "002A4E" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.TITLE,
      children: [new TextRun("Informe de Auditoria ISO 19650")],
    }),
    kv("Organizacion", content.cover.organizationName),
    kv("Numero auditoria", content.cover.auditNumber),
    kv("Numero informe", content.cover.reportNumber),
    kv("Tipo auditoria", content.cover.auditType),
    kv("Norma aplicable", content.cover.standards.join(", ")),
    kv("Fechas auditoria", content.cover.auditDates),
    kv("Fecha informe", content.cover.reportDate),
  ];
}

function heading(text: string, level: 2 | 3 = 2) {
  return new Paragraph({
    heading: level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
    spacing: { before: 280, after: 120 },
    children: [new TextRun(text)],
  });
}

function subsection(title: string, text: string) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: `${title}: `, bold: true }), new TextRun(text || "Sin datos")],
  });
}

function kv(label: string, value: string) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(value || "Sin datos")],
  });
}

function paragraph(text: string) {
  return new Paragraph({ spacing: { after: 120 }, text: text || "Sin datos" });
}

function bullet(text: string) {
  return new Paragraph({ text, bullet: { level: 0 } });
}

function formatStatus(status: string) {
  if (status === "parcial") return "Parcial";
  if (status === "no_conforme") return "No conforme";
  return status || "Sin estado";
}

function table(headers: string[], rows: string[][]) {
  const body = rows.length > 0 ? rows : [headers.map(() => "Sin datos")];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headers.map((header) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: header, bold: true })] })],
          })
        ),
      }),
      ...body.map(
        (row) =>
          new TableRow({
            children: row.map((cell) =>
              new TableCell({ children: [new Paragraph(String(cell || "-"))] })
            ),
          })
      ),
    ],
  });
}
