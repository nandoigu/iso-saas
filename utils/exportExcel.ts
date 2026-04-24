import * as XLSX from "xlsx";
import type { Requirement } from "@/app/projects/[id]/project-requirements";
import {
  formatDate,
  getDisplayValue,
  isRequirementOverdue,
  isRequirementUpcoming,
  normalizeStatus,
} from "@/app/projects/[id]/project-requirements";

export function exportMatrixToExcel(requirements: Requirement[]) {
  const worksheet = XLSX.utils.json_to_sheet(
    requirements.map((requirement) => ({
      Norma: getDisplayValue(requirement.norma, "Sin norma"),
      Item: getDisplayValue(requirement.item, "Sin item"),
      Requerimiento: getDisplayValue(requirement.name, "Sin descripcion"),
      Estado: getStatusLabel(requirement.status),
      Evidencia: getDisplayValue(requirement.evidencia, "Sin evidencia"),
      "Fecha limite": formatDate(requirement.deadline),
      Analitica: getDeadlineLabel(requirement),
    }))
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Matriz");
  XLSX.writeFile(workbook, getExportFilename("xlsx"));
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
