import type {
  AuditReportContent,
  AuditReportInput,
  CorrectiveAction,
  IsoDomainEvaluation,
  ReportParagraph,
  TraceabilityRef,
} from "@/services/audit-report.types";

const ISO_DOMAINS = [
  "Analisis del entorno",
  "Liderazgo",
  "Riesgos y oportunidades",
  "Politicas",
  "Planificacion y control operacional",
  "Recursos y competencias",
  "Comunicacion",
  "Evaluacion del desempeno",
  "Mejora continua",
  "Seguridad de la informacion",
  "Cumplimiento normativo",
];

export function buildAuditReportContent(
  input: AuditReportInput,
  reportNumber: string
): AuditReportContent {
  const standards = input.standards?.length
    ? input.standards
    : ["ISO 19650-1", "ISO 19650-2"];
  const findings = {
    strengths: input.findings?.strengths ?? [],
    improvements: input.findings?.improvements ?? [],
    observations: input.findings?.observations ?? [],
    nonConformities: input.findings?.nonConformities ?? [],
  };
  const globalStatus = getGlobalStatus(
    input.results.complianceScore,
    input.results.riskScore,
    findings.nonConformities
  );
  const recommendation = getFinalRecommendation(
    globalStatus,
    input.results.complianceScore,
    findings.nonConformities
  );
  const executiveSummary = buildExecutiveSummary(input, globalStatus);
  const isoEvaluation = buildIsoEvaluation(input);
  const correctiveActions = buildCorrectiveActions(input);
  const traceability = collectTraceability([
    ...executiveSummary,
    ...findings.strengths,
    ...findings.improvements,
    ...findings.observations,
    ...findings.nonConformities,
    ...isoEvaluation,
  ]);
  const finalReasoning = buildFinalReasoning(input, recommendation, globalStatus);

  return {
    cover: {
      reportNumber,
      auditNumber: input.auditId,
      organizationName: input.organization.name,
      auditType: input.auditType,
      standards,
      auditDates: `${formatDate(input.dates.start)} - ${formatDate(input.dates.end)}`,
      reportDate: formatDate(input.dates.report),
    },
    generalData: {
      organization: input.organization,
      auditTeam: [
        { ...input.leadAuditor, role: "Auditor jefe" },
        ...input.auditors.map((auditor) => ({ ...auditor, role: auditor.role || "Auditor" })),
        ...input.technicalExperts.map((expert) => ({
          ...expert,
          role: expert.role || "Experto tecnico",
        })),
      ],
      auditCriteria: [
        ...standards,
        ...(input.internalProcedures ?? ["Procedimientos internos aplicables"]),
        ...(input.contractualRequirements ?? ["Requisitos contractuales del proyecto"]),
        ...(input.legalRequirements ?? ["Requisitos legales y reglamentarios aplicables"]),
      ],
    },
    executiveSummary,
    executiveResults: {
      complianceScore: input.results.complianceScore,
      maturityScore: input.results.maturityScore,
      riskScore: input.results.riskScore,
      confidenceScore: input.results.confidenceScore,
      globalStatus,
    },
    strengths: findings.strengths,
    improvements: findings.improvements,
    observations: findings.observations,
    nonConformities: findings.nonConformities,
    isoEvaluation,
    finalOpinion: {
      recommendation,
      reasoning: finalReasoning,
    },
    correctiveActions,
    annexes: {
      auditMatrix: input.results.auditedRequirements.map((requirement) => ({
        requirement: [requirement.norma, requirement.item, requirement.name].filter(Boolean).join(" - "),
        status: requirement.status,
        evidence: requirement.evidencia || "Pendiente de completar",
      })),
      evidenceUsed: input.results.analyzedEvidence,
      requirementEvidenceTraceability: Object.values(traceability),
      auditedDocumentRegister: input.results.analyzedEvidence.map((entry) => entry.title),
      previousAuditHistory: ["Sin historial previo informado para esta version del informe."],
    },
    traceability: collectTraceability([...executiveSummary, ...finalReasoning, ...isoEvaluation]),
  };
}

function buildExecutiveSummary(input: AuditReportInput, globalStatus: string): ReportParagraph[] {
  const trace = baseTrace(input);
  const clauses = [
    ["confirmacion-realizacion", `La auditoria ${input.auditId} se ha realizado entre el ${formatDate(input.dates.start)} y el ${formatDate(input.dates.end)} conforme al programa definido.`],
    ["alcance-auditado", `El alcance auditado comprende ${input.scope}.`],
    ["adecuacion-alcance", "El alcance se considera adecuado para valorar la aplicacion del sistema de gestion de informacion BIM frente a ISO 19650."],
    ["muestreo", `El muestreo ha cubierto ${input.results.auditedRequirements.length} requisitos y ${input.results.analyzedEvidence.length} evidencias documentales.`],
    ["declaracion-conformidad", `La declaracion de conformidad resultante es: ${globalStatus}.`],
    ["eficacia-sistema", `La eficacia del sistema se estima con un compliance score de ${input.results.complianceScore}/100 y un maturity score de ${input.results.maturityScore}/100.`],
    ["auditorias-internas", "Se ha considerado la existencia y trazabilidad de auditorias internas en las evidencias disponibles."],
    ["revision-direccion", "La revision por la direccion se evalua segun la evidencia aportada y su alineacion con objetivos BIM y controles ISO 19650."],
    ["estado-nc-anteriores", "El estado de no conformidades anteriores queda sujeto al historial documentado incluido en anexos."],
    ["cambios-significativos", "No se han identificado cambios significativos no controlados fuera de las evidencias analizadas."],
    ["cumplimiento-objetivos", `El cumplimiento de objetivos se valora con un nivel de confianza de ${input.results.confidenceScore}/100.`],
    ["conclusiones-auditor", "El equipo auditor concluye que los resultados son trazables a requisitos, evidencias y niveles de confianza registrados en BAOS."],
  ];

  return clauses.map(([id, text]) => ({ id, text, ...trace }));
}

function buildIsoEvaluation(input: AuditReportInput): IsoDomainEvaluation[] {
  const requirements = input.results.auditedRequirements;
  const evidence = input.results.analyzedEvidence.map((entry) => entry.title);
  const level = clampScore(input.results.complianceScore);

  return ISO_DOMAINS.map((domain, index) => {
    const relatedRequirement = requirements[index % Math.max(requirements.length, 1)];
    return {
      domain,
      result: level >= 80 ? "Control implantado y trazable" : level >= 60 ? "Control parcialmente implantado" : "Control insuficiente",
      strengths: level >= 75 ? ["Trazabilidad documental suficiente", "Criterios ISO identificados"] : ["Evidencia inicial disponible"],
      weaknesses: level < 85 ? ["Conviene reforzar consistencia documental y seguimiento de acciones"] : [],
      evidenceUsed: evidence.slice(0, 5),
      complianceLevel: level,
      requirementId: relatedRequirement?.id ?? "ISO-19650",
      evidenceIds: input.results.analyzedEvidence.slice(0, 5).map((entry) => entry.id),
      confidenceScore: input.results.confidenceScore,
    };
  });
}

function buildCorrectiveActions(input: AuditReportInput): CorrectiveAction[] {
  return (input.findings?.nonConformities ?? []).map((nc) => ({
    nonConformityId: nc.id,
    requiredAction: `Definir, implantar y verificar accion correctiva para: ${nc.description}`,
    owner: input.organization.representative || "Responsable del sistema",
    targetDate: addDays(input.dates.report, nc.severity === "Critica" ? 15 : nc.severity === "Mayor" ? 30 : 60),
    priority: nc.severity === "Critica" || nc.severity === "Mayor" ? "Alta" : "Media",
  }));
}

function buildFinalReasoning(
  input: AuditReportInput,
  recommendation: string,
  globalStatus: string
): ReportParagraph[] {
  return [
    {
      id: "dictamen-final",
      text: `${recommendation}. El dictamen se fundamenta en el estado global ${globalStatus}, el compliance score ${input.results.complianceScore}/100, el risk score ${input.results.riskScore}/100 y la severidad de las no conformidades registradas.`,
      ...baseTrace(input),
    },
  ];
}

export function getGlobalStatus(compliance: number, risk: number, ncs: Array<{ severity: string }>) {
  if (ncs.some((nc) => nc.severity === "Critica") || compliance < 55 || risk >= 80) return "No conforme";
  if (ncs.some((nc) => nc.severity === "Mayor")) return "Conforme con NC menores";
  if (ncs.length > 0 || compliance < 80) return "Conforme con observaciones";
  return "Conforme";
}

export function getFinalRecommendation(
  globalStatus: string,
  compliance: number,
  ncs: Array<{ severity: string }>
) {
  if (globalStatus === "No conforme" || ncs.some((nc) => nc.severity === "Critica")) {
    return "Certificacion no recomendada";
  }

  if (globalStatus !== "Conforme" || compliance < 85) {
    return "Certificacion condicionada";
  }

  return "Certificacion recomendada";
}

function collectTraceability(items: TraceabilityRef[]) {
  return items.reduce<Record<string, TraceabilityRef>>((acc, item, index) => {
    acc[`trace-${index + 1}`] = {
      requirementId: item.requirementId,
      evidenceIds: item.evidenceIds,
      confidenceScore: item.confidenceScore,
    };
    return acc;
  }, {});
}

function baseTrace(input: AuditReportInput): TraceabilityRef {
  return {
    requirementId: input.results.auditedRequirements[0]?.id ?? "ISO-19650",
    evidenceIds: input.results.analyzedEvidence.map((entry) => entry.id),
    confidenceScore: input.results.confidenceScore,
  };
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value));
}

function addDays(value: string, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
