export type RequirementStatus = "total" | "parcial" | "no_conforme";
export type SortMode = "natural" | "deadline" | "status" | "created";
export type DateFilter = "all" | "overdue" | "upcoming" | "no_date";

export type Requirement = {
  id: string;
  norma?: string | null;
  item?: string | null;
  name: string;
  evidencia?: string | null;
  status?: RequirementStatus | null;
  deadline?: string | null;
};

export type EditData = {
  id: string;
  norma: string;
  item: string;
  name: string;
  evidencia: string;
  status: RequirementStatus;
  deadline: string;
};

export const STATUS_META: Record<
  RequirementStatus,
  { label: string; color: string; background: string; border: string; order: number }
> = {
  total: {
    label: "Total",
    color: "#166534",
    background: "#dcfce7",
    border: "#86efac",
    order: 3,
  },
  parcial: {
    label: "Parcial",
    color: "#92400e",
    background: "#fef3c7",
    border: "#fcd34d",
    order: 2,
  },
  no_conforme: {
    label: "No conforme",
    color: "#991b1b",
    background: "#fee2e2",
    border: "#fca5a5",
    order: 1,
  },
};

export const EMPTY_EDIT_DATA: EditData = {
  id: "",
  norma: "",
  item: "",
  name: "",
  evidencia: "",
  status: "no_conforme",
  deadline: "",
};

const naturalCollator = new Intl.Collator("es", {
  numeric: true,
  sensitivity: "base",
});

export function normalizeStatus(
  status?: RequirementStatus | string | null
): RequirementStatus {
  if (status === "total" || status === "parcial" || status === "no_conforme") {
    return status;
  }

  return "no_conforme";
}

export function getDisplayValue(
  value: string | null | undefined,
  fallback: string
) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fecha no valida";
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function getDeadlineTime(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getTime();
}

export function matchesDateFilter(
  requirement: Requirement,
  dateFilter: DateFilter
) {
  if (dateFilter === "all") return true;

  if (!requirement.deadline) {
    return dateFilter === "no_date";
  }

  const deadlineDate = new Date(requirement.deadline);
  if (Number.isNaN(deadlineDate.getTime())) {
    return dateFilter === "no_date";
  }

  const today = startOfToday();
  const upcomingLimit = new Date(today);
  upcomingLimit.setDate(today.getDate() + 7);

  if (dateFilter === "overdue") {
    return deadlineDate < today && normalizeStatus(requirement.status) !== "total";
  }

  if (dateFilter === "upcoming") {
    return (
      deadlineDate >= today &&
      deadlineDate <= upcomingLimit &&
      normalizeStatus(requirement.status) !== "total"
    );
  }

  return false;
}

export function isRequirementOverdue(requirement: Requirement) {
  if (!requirement.deadline || normalizeStatus(requirement.status) === "total") {
    return false;
  }

  const deadlineDate = new Date(requirement.deadline);
  if (Number.isNaN(deadlineDate.getTime())) return false;

  return deadlineDate < startOfToday();
}

export function isRequirementUpcoming(requirement: Requirement, days = 7) {
  if (!requirement.deadline || normalizeStatus(requirement.status) === "total") {
    return false;
  }

  const deadlineDate = new Date(requirement.deadline);
  if (Number.isNaN(deadlineDate.getTime())) return false;

  const today = startOfToday();
  const upcomingLimit = new Date(today);
  upcomingLimit.setDate(today.getDate() + days);

  return deadlineDate >= today && deadlineDate <= upcomingLimit;
}

export function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export function naturalTextCompare(a: string, b: string) {
  return naturalCollator.compare(a, b);
}

export function compareRequirementsNaturally(a: Requirement, b: Requirement) {
  return (
    naturalTextCompare(
      getDisplayValue(a.norma, "Sin norma"),
      getDisplayValue(b.norma, "Sin norma")
    ) ||
    naturalTextCompare(
      getDisplayValue(a.item, "Sin item"),
      getDisplayValue(b.item, "Sin item")
    ) ||
    naturalTextCompare(
      getDisplayValue(a.name, "Sin descripción"),
      getDisplayValue(b.name, "Sin descripción")
    )
  );
}
