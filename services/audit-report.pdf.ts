import PDFDocument from "pdfkit";
import type { AuditReportContent, TraceabilityRef } from "@/services/audit-report.types";

export function generateAuditReportPdf(content: AuditReportContent) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "A4", bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    title(doc, "BAOS");
    title(doc, "Informe de Auditoria ISO 19650", 18);
    kv(doc, "Organizacion", content.cover.organizationName);
    kv(doc, "Numero auditoria", content.cover.auditNumber);
    kv(doc, "Numero informe", content.cover.reportNumber);
    kv(doc, "Tipo auditoria", content.cover.auditType);
    kv(doc, "Norma aplicable", content.cover.standards.join(", "));
    kv(doc, "Fechas auditoria", content.cover.auditDates);
    kv(doc, "Fecha informe", content.cover.reportDate);

    section(doc, "2. Datos Generales");
    kv(doc, "Organizacion", content.generalData.organization.name);
    kv(doc, "Direccion", content.generalData.organization.address || "No informada");
    kv(doc, "Representante", content.generalData.organization.representative || "No informado");
    list(doc, "Equipo auditor", content.generalData.auditTeam.map((p) => `${p.role}: ${p.name} (${p.initials})`));
    list(doc, "Criterios de auditoria", content.generalData.auditCriteria);

    section(doc, "3. Resumen Ejecutivo");
    content.executiveSummary.forEach((paragraph) => paragraphWithTrace(doc, paragraph.text, paragraph));

    section(doc, "4. Resultados Ejecutivos");
    rows(doc, [
      ["Compliance Score", `${content.executiveResults.complianceScore}/100`],
      ["Maturity Score", `${content.executiveResults.maturityScore}/100`],
      ["Risk Score", `${content.executiveResults.riskScore}/100`],
      ["Confidence Score", `${content.executiveResults.confidenceScore}/100`],
      ["Estado Global", content.executiveResults.globalStatus],
    ]);

    section(doc, "5. Fortalezas");
    rows(doc, content.strengths.map((s) => [s.code, s.description, s.evidence]));
    section(doc, "6. Oportunidades de Mejora");
    rows(doc, content.improvements.map((i) => [i.code, i.description, i.recommendation, i.priority]));
    section(doc, "7. Observaciones");
    rows(doc, content.observations.map((o) => [o.reference, o.observation, o.requirement]));
    section(doc, "8. No Conformidades");
    rows(doc, content.nonConformities.map((nc) => [nc.id, nc.isoRequirement, nc.severity, nc.description, nc.evidence, nc.impact, nc.probableCause]));

    section(doc, "9. Evaluacion ISO 19650");
    content.isoEvaluation.forEach((domain) => {
      subsection(doc, domain.domain);
      kv(doc, "Resultado", domain.result);
      kv(doc, "Fortalezas", domain.strengths.join("; ") || "No identificadas");
      kv(doc, "Debilidades", domain.weaknesses.join("; ") || "No identificadas");
      kv(doc, "Evidencia utilizada", domain.evidenceUsed.join("; ") || "No informada");
      kv(doc, "Nivel de cumplimiento", `${domain.complianceLevel}/100`);
      trace(doc, domain);
    });

    section(doc, "10. Dictamen Final");
    doc.font("Helvetica-Bold").text(content.finalOpinion.recommendation);
    content.finalOpinion.reasoning.forEach((paragraph) => paragraphWithTrace(doc, paragraph.text, paragraph));
    section(doc, "11. Plan de Acciones Correctivas");
    rows(doc, content.correctiveActions.map((a) => [a.nonConformityId, a.requiredAction, a.owner, a.targetDate, a.priority]));
    section(doc, "12. Anexos");
    subsection(doc, "Matriz de auditoria");
    rows(doc, content.annexes.auditMatrix.map((row) => [row.requirement, row.status, row.evidence]));
    subsection(doc, "Evidencias utilizadas");
    rows(doc, content.annexes.evidenceUsed.map((e) => [e.id, e.title, e.source || "-"]));
    subsection(doc, "Trazabilidad requisito-evidencia");
    rows(doc, content.annexes.requirementEvidenceTraceability.map((t) => [t.requirementId, t.evidenceIds.join(", "), `${t.confidenceScore}/100`]));

    doc.end();
  });
}

function title(doc: PDFKit.PDFDocument, text: string, size = 24) {
  ensureSpace(doc, 80);
  doc.font("Helvetica-Bold").fontSize(size).fillColor("#002a4e").text(text, { align: "center" });
  doc.moveDown(0.7);
}

function section(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, 90);
  doc.moveDown(0.8).font("Helvetica-Bold").fontSize(15).fillColor("#002a4e").text(text);
  doc.moveDown(0.3);
}

function subsection(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, 70);
  doc.moveDown(0.4).font("Helvetica-Bold").fontSize(12).fillColor("#0f172a").text(text);
}

function kv(doc: PDFKit.PDFDocument, label: string, value: string) {
  ensureSpace(doc, 38);
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text(`${label}: `, { continued: true });
  doc.font("Helvetica").text(value);
}

function list(doc: PDFKit.PDFDocument, label: string, values: string[]) {
  subsection(doc, label);
  (values.length ? values : ["Sin datos"]).forEach((value) => {
    ensureSpace(doc, 28);
    doc.font("Helvetica").fontSize(10).fillColor("#0f172a").text(`- ${value}`);
  });
}

function paragraphWithTrace(doc: PDFKit.PDFDocument, text: string, ref: TraceabilityRef) {
  ensureSpace(doc, 70);
  doc.font("Helvetica").fontSize(10).fillColor("#0f172a").text(text, { lineGap: 3 });
  trace(doc, ref);
  doc.moveDown(0.4);
}

function trace(doc: PDFKit.PDFDocument, ref: TraceabilityRef) {
  ensureSpace(doc, 24);
  doc.font("Helvetica-Oblique")
    .fontSize(7)
    .fillColor("#64748b")
    .text(`[requirement_id=${ref.requirementId}; evidence_ids=${ref.evidenceIds.join(",")}; confidence_score=${ref.confidenceScore}]`);
}

function rows(doc: PDFKit.PDFDocument, rowsData: string[][]) {
  const data = rowsData.length ? rowsData : [["Sin datos"]];

  data.forEach((row) => {
    ensureSpace(doc, 42);
    doc.font("Helvetica").fontSize(9).fillColor("#0f172a").text(row.map((cell) => String(cell || "-")).join(" | "), {
      lineGap: 2,
    });
    doc.moveDown(0.25);
  });
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}
