import type { AuditReportContent, AuditReportInput } from "@/services/audit-report.types";

export function buildAuditReportContent(
  input: AuditReportInput,
  reportNumber: string,
  project: { name: string; code?: string | null }
): AuditReportContent {
  const compliantRequirements = input.results.auditedRequirements.filter((requirement) =>
    isCompliantStatus(requirement.status)
  );
  const nonConformityRequirements = input.results.auditedRequirements.filter((requirement) =>
    isNonConformityStatus(requirement.status)
  );
  const requirementIds = input.results.auditedRequirements.map((requirement) => requirement.id);
  const evidenceIds = input.results.analyzedEvidence.map((evidence) => evidence.id);
  const auditMatrix = input.results.auditedRequirements.map((requirement) => ({
    requirementId: requirement.id,
    requirement: formatRequirement(requirement),
    status: requirement.status,
    evidence: requirement.evidence || "Sin evidencia registrada",
  }));
  const indicators = calculateIndicators(auditMatrix);
  const status = getExecutiveStatus(
    indicators.weightedComplianceScore,
    Math.max(0, 100 - indicators.weightedComplianceScore)
  );
  const decision = getFinalDecision(status, indicators.weightedComplianceScore);

  return {
    cover: {
      reportNumber,
      auditNumber: input.auditId,
      organizationName: input.organization.name,
      auditType: input.auditType,
      standards: input.standards,
      auditDates: `${formatDate(input.dates.start)} - ${formatDate(input.dates.end)}`,
      reportDate: formatDate(input.dates.report),
    },
    generalData: {
      projectName: project.name,
      projectCode: project.code || "Sin codigo",
      organizationName: input.organization.name,
      organizationAddress: input.organization.address || "No informado",
      organizationRepresentative: input.organization.representative || "No informado",
      leadAuditorName: input.leadAuditor.name,
      leadAuditorInitials: input.leadAuditor.initials,
      certificationScope: input.scope,
    },
    auditCriteria: [
      ...input.standards,
      "Requisitos del proyecto registrados en BAOS",
      "Evidencias documentales asociadas a los requisitos auditados",
    ],
    executiveSummary: {
      generalIssues: `Se ha generado un informe basico de auditoria para el proyecto ${project.name}, tomando como base ${input.results.auditedRequirements.length} requisitos y ${input.results.analyzedEvidence.length} evidencias registradas.`,
      scopeAdequacy: `El alcance definido es adecuado para una revision documental inicial: ${input.scope}`,
      auditObjectives:
        "Verificar el grado de cumplimiento de los requisitos ISO 19650 registrados en la matriz del proyecto y consolidar un dictamen trazable.",
      auditContext:
        "La auditoria se basa en la informacion disponible en la plataforma en el momento de generacion del informe.",
      auditorGeneralConsiderations:
        "El auditor debe revisar y ajustar esta previsualizacion antes de emitir el informe definitivo.",
      strengths:
        compliantRequirements.length > 0
          ? `${compliantRequirements.length} requisitos aparecen en estado conforme o equivalente.`
          : "No se han identificado puntos fuertes automaticos en esta version basica.",
      weaknessesAndImprovements:
        nonConformityRequirements.length > 0
          ? `${nonConformityRequirements.length} requisitos requieren revision, cierre documental o mejora.`
          : "No se han identificado debilidades relevantes a partir de los estados actuales.",
      observations:
        input.results.analyzedEvidence.length > 0
          ? "Existen evidencias vinculadas a requisitos auditados. Debe revisarse su suficiencia antes de emitir el informe."
          : "No constan evidencias documentales asociadas; se recomienda completar la trazabilidad.",
      nonConformities: auditMatrix.filter((row) => isNonConformityStatus(row.status)).map((row) => ({
        requirementId: row.requirementId,
        itemCode: extractRequirementCode(row.requirement),
        status: row.status,
        reason: "",
      })),
    },
    executiveResult: {
      complianceScore: indicators.weightedComplianceScore,
      riskScore: Math.max(0, 100 - indicators.weightedComplianceScore),
      confidenceScore: input.results.confidenceScore,
      status,
    },
    finalOpinion: {
      decision,
      rationale: `Dictamen calculado con cumplimiento ponderado ${indicators.weightedComplianceScore}/100 sobre ${indicators.totalRequirements} requisitos auditados. El auditor puede modificar este razonamiento durante la previsualizacion.`,
    },
    annexes: {
      auditMatrix,
      kpis: indicators,
    },
    traceability: [
      {
        section: "Resumen ejecutivo",
        requirementIds,
        evidenceIds,
        confidenceScore: input.results.confidenceScore,
      },
      {
        section: "Dictamen final",
        requirementIds,
        evidenceIds,
        confidenceScore: input.results.confidenceScore,
      },
      {
        section: "Anexos",
        requirementIds,
        evidenceIds,
        confidenceScore: input.results.confidenceScore,
      },
    ],
  };
}

export function getExecutiveStatus(complianceScore: number, riskScore: number) {
  if (complianceScore >= 85 && riskScore <= 35) return "Conforme";
  if (complianceScore >= 70 && riskScore <= 55) return "Conforme con observaciones";
  if (complianceScore >= 55) return "Conforme con acciones requeridas";
  return "No conforme";
}

function getFinalDecision(status: string, complianceScore: number) {
  if (status === "Conforme") return "Certificacion recomendada";
  if (complianceScore >= 55) return "Certificacion condicionada";
  return "Certificacion no recomendada";
}

function isCompliantStatus(status: string) {
  return ["total", "conforme", "cumple", "completed", "compliant", "aprobado"].includes(
    status.trim().toLowerCase()
  );
}

function isNonConformityStatus(status: string) {
  return ["no_conforme", "no conforme", "non compliant", "parcial", "partial"].includes(
    status.trim().toLowerCase()
  );
}

function calculateIndicators(auditMatrix: Array<{ status: string; evidence: string }>) {
  const totalRequirements = auditMatrix.length;
  const compliantRequirements = auditMatrix.filter((row) => isCompliantStatus(row.status)).length;
  const partialRequirements = auditMatrix.filter((row) => isPartialStatus(row.status)).length;
  const nonCompliantRequirements = auditMatrix.filter((row) => isNoConformityStatus(row.status)).length;
  const evidenceCount = auditMatrix.filter((row) => hasEvidence(row.evidence)).length;
  const weightedScore =
    totalRequirements > 0
      ? Math.round(((compliantRequirements + partialRequirements * 0.5) / totalRequirements) * 100)
      : 0;

  return {
    totalRequirements,
    compliantRequirements,
    partialRequirements,
    nonCompliantRequirements,
    evidenceCount,
    weightedComplianceScore: weightedScore,
  };
}

function isPartialStatus(status: string) {
  return ["parcial", "partial"].includes(status.trim().toLowerCase());
}

function isNoConformityStatus(status: string) {
  return ["no_conforme", "no conforme", "non compliant"].includes(status.trim().toLowerCase());
}

function hasEvidence(evidence: string) {
  const normalized = evidence.trim().toLowerCase();
  return Boolean(normalized) && !["sin evidencia registrada", "pendiente de completar"].includes(normalized);
}

function formatRequirement(requirement: { norma?: string | null; item?: string | null; title: string }) {
  return [requirement.norma, requirement.item, requirement.title].filter(Boolean).join(" - ");
}

function extractRequirementCode(requirement: string) {
  const parts = requirement.split(" - ").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2 && /^\d/.test(parts[1])) return `${parts[0]} - ${parts[1]}`;
  return parts[0] || requirement;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value));
}
