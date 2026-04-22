export type AlertRequirementStatus = "total" | "parcial" | "no_conforme";

export type AlertRequirement = {
  id: string;
  norma: string | null;
  item: string | null;
  name: string;
  status: string;
  deadline: Date | string | null;
  projectName: string;
};

export type ComplianceMetrics = {
  compliance: number;
  totalRequirements: number;
  overdue: number;
  upcoming: number;
};

export type ComplianceReport = {
  metrics: ComplianceMetrics;
  overdueRequirements: AlertRequirement[];
  upcomingRequirements: AlertRequirement[];
  requirements: AlertRequirement[];
};

const STATUS_SCORE: Record<AlertRequirementStatus, number> = {
  total: 1,
  parcial: 0.5,
  no_conforme: 0,
};

export function buildComplianceReport(
  requirements: AlertRequirement[],
  upcomingDays = 7
): ComplianceReport {
  const normalizedRequirements = requirements.map((requirement) => ({
    ...requirement,
    status: normalizeStatus(requirement.status),
  }));
  const totalScore = normalizedRequirements.reduce(
    (sum, requirement) => sum + STATUS_SCORE[requirement.status],
    0
  );
  const overdueRequirements = normalizedRequirements.filter(isRequirementOverdue);
  const upcomingRequirements = normalizedRequirements.filter((requirement) =>
    isRequirementUpcoming(requirement, upcomingDays)
  );

  return {
    metrics: {
      compliance:
        normalizedRequirements.length > 0
          ? Math.round((totalScore / normalizedRequirements.length) * 100)
          : 0,
      totalRequirements: normalizedRequirements.length,
      overdue: overdueRequirements.length,
      upcoming: upcomingRequirements.length,
    },
    overdueRequirements,
    upcomingRequirements,
    requirements: normalizedRequirements,
  };
}

export function flattenProjectRequirements(
  projects: Array<{
    name: string;
    requirements: Array<{
      id: string;
      norma: string | null;
      item: string | null;
      name: string;
      status: string;
      deadline: Date | null;
    }>;
  }>
) {
  return projects.flatMap((project) =>
    project.requirements.map((requirement) => ({
      ...requirement,
      projectName: project.name,
    }))
  );
}

export function shouldSendDailyEmail(lastSentAt: Date | null | undefined) {
  if (!lastSentAt) return true;

  return lastSentAt < startOfToday();
}

export function shouldSendReportEmail(
  frequency: string,
  lastSentAt: Date | null | undefined
) {
  if (!lastSentAt) return true;

  const now = new Date();
  const elapsedMs = now.getTime() - lastSentAt.getTime();
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);

  if (frequency === "daily") return lastSentAt < startOfToday();

  return elapsedDays >= 7;
}

export function normalizeStatus(status: string | null | undefined): AlertRequirementStatus {
  if (status === "total" || status === "parcial" || status === "no_conforme") {
    return status;
  }

  return "no_conforme";
}

export function formatEmailDate(value: Date | string | null | undefined) {
  if (!value) return "Sin fecha";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function isRequirementOverdue(requirement: AlertRequirement) {
  if (!requirement.deadline || normalizeStatus(requirement.status) === "total") {
    return false;
  }

  const deadline = new Date(requirement.deadline);
  if (Number.isNaN(deadline.getTime())) return false;

  return deadline < startOfToday();
}

export function isRequirementUpcoming(requirement: AlertRequirement, days: number) {
  if (!requirement.deadline || normalizeStatus(requirement.status) === "total") {
    return false;
  }

  const deadline = new Date(requirement.deadline);
  if (Number.isNaN(deadline.getTime())) return false;

  const today = startOfToday();
  const limit = new Date(today);
  limit.setDate(limit.getDate() + days);

  return deadline >= today && deadline <= limit;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}
