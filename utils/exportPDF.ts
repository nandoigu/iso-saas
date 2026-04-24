import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Requirement } from "@/app/projects/[id]/project-requirements";
import {
  formatDate,
  getDisplayValue,
  isRequirementOverdue,
  isRequirementUpcoming,
  normalizeStatus,
} from "@/app/projects/[id]/project-requirements";

export function exportMatrixToPDF(requirements: Requirement[]) {
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const generatedAt = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  pdf.setFillColor(0, 42, 78);
  pdf.rect(0, 0, 297, 24, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("Matriz de cumplimiento", 14, 14);
  pdf.setFontSize(10);
  pdf.text(`Generado: ${generatedAt}`, 14, 20);

  autoTable(pdf, {
    startY: 32,
    head: [[
      "Norma",
      "Item",
      "Requerimiento",
      "Estado",
      "Evidencia",
      "Fecha limite",
      "Analitica",
    ]],
    body: requirements.map((requirement) => [
      getDisplayValue(requirement.norma, "Sin norma"),
      getDisplayValue(requirement.item, "Sin item"),
      getDisplayValue(requirement.name, "Sin descripcion"),
      getStatusLabel(requirement.status),
      getDisplayValue(requirement.evidencia, "Sin evidencia"),
      formatDate(requirement.deadline),
      getDeadlineLabel(requirement),
    ]),
    styles: {
      cellPadding: 2.4,
      font: "helvetica",
      fontSize: 8,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: [0, 42, 78],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [244, 246, 252],
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 22 },
      2: { cellWidth: 88 },
      3: { cellWidth: 24 },
      4: { cellWidth: 68 },
      5: { cellWidth: 28 },
      6: { cellWidth: 26 },
    },
  });

  pdf.save(getExportFilename("pdf"));
}

function getStatusLabel(status?: string | null) {
  const normalized = normalizeStatus(status);

  if (normalized === "total") return "Total";
  if (normalized === "parcial") return "Parcial";
  return "No conforme";
}

function getDeadlineLabel(requirement: Requirement) {
  if (!requirement.deadline) return "Sin fecha";
  if (isRequirementOverdue(requirement)) return "Vencido";
  if (isRequirementUpcoming(requirement)) return "Proximo";
  return "En plazo";
}

function getExportFilename(extension: "xlsx" | "pdf") {
  const today = new Date().toISOString().slice(0, 10);
  return `matriz_cumplimiento_${today}.${extension}`;
}
