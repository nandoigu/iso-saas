import PDFDocument from "pdfkit";
import type { AuditReportContent } from "@/services/audit-report.types";

export function generateAuditReportPdf(content: AuditReportContent) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "A4", bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    title(doc, "BAOS");
    title(doc, "Informe de Auditoria ISO 19650", 18);
    section(doc, "1. Datos generales");
    kv(doc, "Organizacion", content.cover.organizationName);
    kv(doc, "Numero auditoria", content.cover.auditNumber);
    kv(doc, "Numero informe", content.cover.reportNumber);
    kv(doc, "Tipo auditoria", content.cover.auditType);
    kv(doc, "Norma aplicable", content.cover.standards.join(", "));
    kv(doc, "Fechas auditoria", content.cover.auditDates);
    kv(doc, "Fecha informe", content.cover.reportDate);

    kv(doc, "Proyecto", content.generalData.projectName);
    kv(doc, "Codigo", content.generalData.projectCode);
    kv(doc, "Organizacion", content.generalData.organizationName);
    kv(doc, "Direccion", content.generalData.organizationAddress);
    kv(doc, "Representante", content.generalData.organizationRepresentative);
    kv(doc, "Auditor", `${content.generalData.leadAuditorName} (${content.generalData.leadAuditorInitials})`);
    kv(doc, "Alcance de la certificacion", content.generalData.certificationScope);

    section(doc, "2. Criterios de Auditoria");
    content.auditCriteria.forEach((criterion) => line(doc, `- ${criterion}`));

    section(doc, "3. Resumen ejecutivo");
    kv(doc, "Cuestiones generales", content.executiveSummary.generalIssues);
    kv(doc, "Adecuacion del alcance", content.executiveSummary.scopeAdequacy);
    kv(doc, "Objetivos de auditoria", content.executiveSummary.auditObjectives);
    kv(doc, "Contexto de la auditoria", content.executiveSummary.auditContext);
    kv(doc, "Consideraciones generales del auditor", content.executiveSummary.auditorGeneralConsiderations);
    kv(doc, "Puntos fuertes", content.executiveSummary.strengths);
    kv(doc, "Debilidades y oportunidades de mejora", content.executiveSummary.weaknessesAndImprovements);
    kv(doc, "Observaciones", content.executiveSummary.observations);
    kv(doc, "No conformidades", content.executiveSummary.nonConformities);

    section(doc, "4. Resultado ejecutivo");
    rows(doc, [
      ["Compliance Score", `${content.executiveResult.complianceScore}/100`],
      ["Risk Score", `${content.executiveResult.riskScore}/100`],
      ["Confidence Score", `${content.executiveResult.confidenceScore}/100`],
      ["Estado", content.executiveResult.status],
    ]);

    section(doc, "5. Dictamen final");
    kv(doc, "Dictamen", content.finalOpinion.decision);
    line(doc, content.finalOpinion.rationale);

    section(doc, "6. Anexos");
    subsection(doc, "Matriz de auditoria");
    rows(doc, content.annexes.auditMatrix.map((row) => [row.requirement, row.status, row.evidence]));
    subsection(doc, "KPIs");
    rows(doc, [
      ["Compliance Score", `${content.annexes.kpis.complianceScore}/100`],
      ["Risk Score", `${content.annexes.kpis.riskScore}/100`],
      ["Confidence Score", `${content.annexes.kpis.confidenceScore}/100`],
    ]);

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
  ensureSpace(doc, 44);
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text(`${label}: `, {
    continued: true,
  });
  doc.font("Helvetica").text(value || "Sin datos", { lineGap: 2 });
}

function line(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, 34);
  doc.font("Helvetica").fontSize(10).fillColor("#0f172a").text(text || "Sin datos", { lineGap: 2 });
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
