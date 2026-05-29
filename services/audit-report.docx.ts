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
import type { AuditReportContent, TraceabilityRef } from "@/services/audit-report.types";

export async function generateAuditReportDocx(content: AuditReportContent) {
  const doc = new Document({
    creator: "BAOS",
    description: "Informe de auditoria ISO 19650 generado automaticamente",
    title: content.cover.reportNumber,
    sections: [
      {
        properties: {},
        children: [
          ...cover(content),
          heading("2. Datos Generales"),
          kv("Organizacion", content.generalData.organization.name),
          kv("Direccion", content.generalData.organization.address || "No informada"),
          kv("Representante", content.generalData.organization.representative || "No informado"),
          heading("Equipo Auditor", 3),
          table(["Funcion", "Nombre", "Iniciales"], content.generalData.auditTeam.map((p) => [p.role || "-", p.name, p.initials])),
          heading("Criterios de Auditoria", 3),
          ...content.generalData.auditCriteria.map((criterion) => bullet(criterion)),
          heading("3. Resumen Ejecutivo"),
          ...content.executiveSummary.map(traceableParagraph),
          heading("4. Resultados Ejecutivos"),
          table(["KPI", "Resultado"], [
            ["Compliance Score", `${content.executiveResults.complianceScore}/100`],
            ["Maturity Score", `${content.executiveResults.maturityScore}/100`],
            ["Risk Score", `${content.executiveResults.riskScore}/100`],
            ["Confidence Score", `${content.executiveResults.confidenceScore}/100`],
            ["Estado Global", content.executiveResults.globalStatus],
          ]),
          heading("5. Fortalezas"),
          table(["Codigo", "Descripcion", "Evidencia"], content.strengths.map((s) => [s.code, s.description, s.evidence])),
          heading("6. Oportunidades de Mejora"),
          table(["Codigo", "Descripcion", "Recomendacion", "Prioridad"], content.improvements.map((i) => [i.code, i.description, i.recommendation, i.priority])),
          heading("7. Observaciones"),
          table(["Referencia", "Observacion", "Requisito asociado"], content.observations.map((o) => [o.reference, o.observation, o.requirement])),
          heading("8. No Conformidades"),
          table(["NC-ID", "Requisito ISO", "Severidad", "Descripcion", "Evidencia", "Impacto", "Causa probable"], content.nonConformities.map((nc) => [nc.id, nc.isoRequirement, nc.severity, nc.description, nc.evidence, nc.impact, nc.probableCause])),
          heading("9. Evaluacion ISO 19650"),
          ...content.isoEvaluation.flatMap((domain) => [
            heading(domain.domain, 3),
            kv("Resultado", domain.result),
            kv("Fortalezas", domain.strengths.join("; ") || "No identificadas"),
            kv("Debilidades", domain.weaknesses.join("; ") || "No identificadas"),
            kv("Evidencia utilizada", domain.evidenceUsed.join("; ") || "No informada"),
            kv("Nivel de cumplimiento", `${domain.complianceLevel}/100`),
            traceMeta(domain),
          ]),
          heading("10. Dictamen Final"),
          new Paragraph({ children: [new TextRun({ text: content.finalOpinion.recommendation, bold: true })] }),
          ...content.finalOpinion.reasoning.map(traceableParagraph),
          heading("11. Plan de Acciones Correctivas"),
          table(["NC", "Accion requerida", "Responsable", "Fecha objetivo", "Prioridad"], content.correctiveActions.map((a) => [a.nonConformityId, a.requiredAction, a.owner, a.targetDate, a.priority])),
          heading("12. Anexos"),
          heading("Matriz de auditoria", 3),
          table(["Requisito", "Estado", "Evidencia"], content.annexes.auditMatrix.map((row) => [row.requirement, row.status, row.evidence])),
          heading("Evidencias utilizadas", 3),
          table(["ID", "Titulo", "Fuente"], content.annexes.evidenceUsed.map((e) => [e.id, e.title, e.source || "-"])),
          heading("Trazabilidad requisito-evidencia", 3),
          table(["Requirement ID", "Evidence IDs", "Confidence"], content.annexes.requirementEvidenceTraceability.map((t) => [t.requirementId, t.evidenceIds.join(", "), `${t.confidenceScore}/100`])),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

function cover(content: AuditReportContent) {
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

function kv(label: string, value: string) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(value)],
  });
}

function bullet(text: string) {
  return new Paragraph({ text, bullet: { level: 0 } });
}

function traceableParagraph(paragraph: { text: string } & TraceabilityRef) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun(paragraph.text), new TextRun({ text: traceText(paragraph), italics: true, size: 16, color: "64748B" })],
  });
}

function traceMeta(trace: TraceabilityRef) {
  return new Paragraph({
    children: [new TextRun({ text: traceText(trace), italics: true, size: 16, color: "64748B" })],
  });
}

function traceText(trace: TraceabilityRef) {
  return ` [requirement_id=${trace.requirementId}; evidence_ids=${trace.evidenceIds.join(",")}; confidence_score=${trace.confidenceScore}]`;
}

function table(headers: string[], rows: string[][]) {
  const body = rows.length > 0 ? rows : [headers.map(() => "Sin datos")];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headers.map((header) =>
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: header, bold: true })] })] })
        ),
      }),
      ...body.map(
        (row) =>
          new TableRow({
            children: row.map((cell) => new TableCell({ children: [new Paragraph(String(cell || "-"))] })),
          })
      ),
    ],
  });
}
