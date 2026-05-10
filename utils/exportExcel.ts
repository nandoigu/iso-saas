import ExcelJS from "exceljs";
import type { Requirement } from "@/app/projects/[id]/project-requirements";
import {
  formatDate,
  getDisplayValue,
  isRequirementOverdue,
  isRequirementUpcoming,
  normalizeStatus,
} from "@/app/projects/[id]/project-requirements";

export async function exportMatrixToExcel(requirements: Requirement[]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Matriz");

  worksheet.columns = [
    { header: "Norma", key: "norma", width: 18 },
    { header: "Item", key: "item", width: 14 },
    { header: "Requerimiento", key: "requirement", width: 46 },
    { header: "Estado", key: "status", width: 16 },
    { header: "Evidencia", key: "evidence", width: 42 },
    { header: "Fecha limite", key: "deadline", width: 16 },
    { header: "Analitica", key: "analytics", width: 16 },
  ];

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF002A4E" },
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  requirements.forEach((requirement) => {
    worksheet.addRow({
      norma: getDisplayValue(requirement.norma, "Sin norma"),
      item: getDisplayValue(requirement.item, "Sin item"),
      requirement: getDisplayValue(requirement.name, "Sin descripcion"),
      status: getStatusLabel(requirement.status),
      evidence: getDisplayValue(requirement.evidencia, "Sin evidencia"),
      deadline: formatDate(requirement.deadline),
      analytics: getDeadlineLabel(requirement),
    });
  });

  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = getExportFilename("xlsx");
  link.click();
  URL.revokeObjectURL(url);
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
