"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  DateFilter,
  Requirement,
  RequirementStatus,
} from "@/app/projects/[id]/project-requirements";
import {
  STATUS_META,
  formatDate,
  getDisplayValue,
  isRequirementOverdue,
  isRequirementUpcoming,
  matchesDateFilter,
  naturalTextCompare,
  normalizeStatus,
} from "@/app/projects/[id]/project-requirements";
import { exportMatrixToExcel } from "@/utils/exportExcel";
import { exportMatrixToPDF } from "@/utils/exportPDF";

type ComplianceMatrixProps = {
  requirements: Requirement[];
};

const VALID_DATE_FILTERS: DateFilter[] = ["all", "overdue", "upcoming", "no_date"];
const VALID_STATUSES: RequirementStatus[] = ["total", "parcial", "no_conforme"];

export default function ComplianceMatrix({
  requirements,
}: ComplianceMatrixProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const isCompact = useMatrixBreakpoint() === "compact";

  const selectedNorma = searchParams.get("norma") || "all";
  const selectedStatuses = useMemo(() => {
    const raw = searchParams.get("status");
    if (!raw) return [] as RequirementStatus[];

    return raw
      .split(",")
      .map((value) => value.trim())
      .filter((value): value is RequirementStatus =>
        VALID_STATUSES.includes(value as RequirementStatus)
      );
  }, [searchParams]);
  const dateFilter = useMemo(() => {
    const raw = searchParams.get("date");
    return VALID_DATE_FILTERS.includes(raw as DateFilter)
      ? (raw as DateFilter)
      : "all";
  }, [searchParams]);
  const searchTerm = searchParams.get("q") || "";

  const normaOptions = useMemo(() => {
    return Array.from(
      new Set(
        requirements
          .map((requirement) => requirement.norma?.trim())
          .filter((value): value is string => Boolean(value))
      )
    ).sort(naturalTextCompare);
  }, [requirements]);

  const filteredRequirements = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return requirements.filter((requirement) => {
      const norma = getDisplayValue(requirement.norma, "Sin norma");
      const status = normalizeStatus(requirement.status);
      const searchableText = [
        norma,
        getDisplayValue(requirement.item, "Sin item"),
        getDisplayValue(requirement.name, "Sin descripción"),
        getDisplayValue(requirement.evidencia, "Sin evidencia"),
      ]
        .join(" ")
        .toLowerCase();

      if (selectedNorma !== "all" && norma !== selectedNorma) {
        return false;
      }

      if (selectedStatuses.length > 0 && !selectedStatuses.includes(status)) {
        return false;
      }

      if (!matchesDateFilter(requirement, dateFilter)) {
        return false;
      }

      if (normalizedSearch && !searchableText.includes(normalizedSearch)) {
        return false;
      }

      return true;
    });
  }, [requirements, searchTerm, selectedNorma, selectedStatuses, dateFilter]);

  const summary = useMemo(() => {
    const total = filteredRequirements.length;
    const totals = filteredRequirements.reduce(
      (acc, requirement) => {
        const status = normalizeStatus(requirement.status);
        acc[status] += 1;
        return acc;
      },
      {
        total: 0,
        parcial: 0,
        no_conforme: 0,
      }
    );
    const score = filteredRequirements.reduce((sum, requirement) => {
      const status = normalizeStatus(requirement.status);
      if (status === "total") return sum + 1;
      if (status === "parcial") return sum + 0.5;
      return sum;
    }, 0);

    return {
      total,
      completed: totals.total,
      partial: totals.parcial,
      nonCompliant: totals.no_conforme,
      percent: total > 0 ? Math.round((score / total) * 100) : 0,
      overdue: filteredRequirements.filter(isRequirementOverdue).length,
      upcoming: filteredRequirements.filter((requirement) =>
        isRequirementUpcoming(requirement)
      ).length,
      withoutDate: filteredRequirements.filter((requirement) => !requirement.deadline)
        .length,
    };
  }, [filteredRequirements]);

  const matrixData = useMemo(() => {
    return Object.entries(
      filteredRequirements.reduce(
        (acc: Record<string, Record<string, Requirement[]>>, requirement) => {
          const normaKey = getDisplayValue(requirement.norma, "Sin norma");
          const itemKey = getDisplayValue(requirement.item, "Sin item");

          if (!acc[normaKey]) acc[normaKey] = {};
          if (!acc[normaKey][itemKey]) acc[normaKey][itemKey] = [];

          acc[normaKey][itemKey].push(requirement);
          return acc;
        },
        {}
      )
    ).sort(([left], [right]) => naturalTextCompare(left, right));
  }, [filteredRequirements]);

  const activeFilterCount =
    (selectedNorma !== "all" ? 1 : 0) +
    selectedStatuses.length +
    (dateFilter !== "all" ? 1 : 0) +
    (searchTerm.trim() ? 1 : 0);

  const updateQueryParams = (updates: Record<string, string | null>) => {
    const nextParams = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === "all") {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
    });

    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const toggleStatusFilter = (status: RequirementStatus) => {
    const nextStatuses = selectedStatuses.includes(status)
      ? selectedStatuses.filter((current) => current !== status)
      : [...selectedStatuses, status].sort(
          (left, right) =>
            VALID_STATUSES.indexOf(left) - VALID_STATUSES.indexOf(right)
        );

    updateQueryParams({
      status: nextStatuses.length > 0 ? nextStatuses.join(",") : null,
    });
  };

  const resetFilters = () => {
    updateQueryParams({
      norma: null,
      status: null,
      date: null,
      q: null,
    });
  };

  const handleExportExcel = async () => {
    setExporting("excel");
    try {
      await exportMatrixToExcel(filteredRequirements);
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = async () => {
    setExporting("pdf");
    try {
      exportMatrixToPDF(filteredRequirements);
    } finally {
      setExporting(null);
    }
  };

  return (
    <section style={{ display: "grid", gap: isCompact ? 14 : 18, minWidth: 0 }}>
      <section
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
          minWidth: 0,
          padding: isCompact ? 14 : 18,
        }}
      >
        <div
          style={{
            alignItems: isCompact ? "stretch" : "center",
            display: isCompact ? "grid" : "flex",
            flexWrap: "wrap",
            gap: 14,
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div>
            <h2 style={{ fontSize: 18, margin: 0 }}>Vista matricial</h2>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "6px 0 0" }}>
              {filteredRequirements.length} de {requirements.length} requerimientos
              visibles
              {activeFilterCount > 0
                ? ` - ${activeFilterCount} filtros activos`
                : ""}
            </p>
          </div>

          <div
            style={{
              display: isCompact ? "grid" : "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredRequirements.length === 0 || exporting !== null}
              style={{
                ...secondaryButtonStyle,
                cursor:
                  filteredRequirements.length === 0 || exporting !== null
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  filteredRequirements.length === 0 || exporting !== null ? 0.5 : 1,
              }}
            >
              {exporting === "excel" ? "Exportando..." : "Exportar Excel"}
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              disabled={filteredRequirements.length === 0 || exporting !== null}
              style={{
                ...secondaryButtonStyle,
                cursor:
                  filteredRequirements.length === 0 || exporting !== null
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  filteredRequirements.length === 0 || exporting !== null ? 0.5 : 1,
              }}
            >
              {exporting === "pdf" ? "Exportando..." : "Exportar PDF"}
            </button>

            <button
              type="button"
              onClick={resetFilters}
              disabled={activeFilterCount === 0}
              style={{
                ...secondaryButtonStyle,
                cursor: activeFilterCount === 0 ? "not-allowed" : "pointer",
                opacity: activeFilterCount === 0 ? 0.5 : 1,
              }}
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: isCompact
              ? "minmax(0, 1fr)"
              : "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <label style={filterLabelStyle}>
            Buscar
            <input
              value={searchTerm}
              onChange={(event) =>
                updateQueryParams({
                  q: event.target.value.trim() ? event.target.value : null,
                })
              }
              placeholder="Norma, item, requerimiento o evidencia"
              style={controlStyle}
            />
          </label>

          <label style={filterLabelStyle}>
            Norma
            <select
              value={selectedNorma}
              onChange={(event) =>
                updateQueryParams({
                  norma: event.target.value === "all" ? null : event.target.value,
                })
              }
              style={controlStyle}
            >
              <option value="all">Todas las normas</option>
              {normaOptions.map((norma) => (
                <option key={norma} value={norma}>
                  {norma}
                </option>
              ))}
            </select>
          </label>

          <label style={filterLabelStyle}>
            Fecha
            <select
              value={dateFilter}
              onChange={(event) =>
                updateQueryParams({
                  date: event.target.value === "all" ? null : event.target.value,
                })
              }
              style={controlStyle}
            >
              <option value="all">Todas las fechas</option>
              <option value="overdue">Vencidos</option>
              <option value="upcoming">Próximos 7 días</option>
              <option value="no_date">Sin fecha</option>
            </select>
          </label>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ color: "#374151", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            Estado
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {VALID_STATUSES.map((status) => {
              const meta = STATUS_META[status];
              const active = selectedStatuses.includes(status);

              return (
                <label
                  key={status}
                  style={{
                    alignItems: "center",
                    background: active ? meta.background : "#f9fafb",
                    border: `1px solid ${active ? meta.border : "#e5e7eb"}`,
                    borderRadius: 999,
                    color: active ? meta.color : "#374151",
                    cursor: "pointer",
                    display: "inline-flex",
                    fontSize: 13,
                    fontWeight: 700,
                    gap: 6,
                    padding: "7px 10px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleStatusFilter(status)}
                  />
                  {meta.label}
                </label>
              );
            })}
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: isCompact
            ? "repeat(2, minmax(0, 1fr))"
            : "repeat(auto-fit, minmax(170px, 1fr))",
        }}
      >
        <SummaryCard label="Requerimientos" value={summary.total} />
        <SummaryCard label="Cumplimiento" value={`${summary.percent}%`} />
        <SummaryCard label="Vencidos" value={summary.overdue} accent="#dc2626" />
        <SummaryCard label="Próximos" value={summary.upcoming} accent="#d97706" />
        <SummaryCard label="Sin fecha" value={summary.withoutDate} accent="#6b7280" />
        <SummaryCard
          label="No conforme"
          value={summary.nonCompliant}
          accent={STATUS_META.no_conforme.color}
        />
      </section>

      {matrixData.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          description="No hay requerimientos que coincidan con los filtros actuales."
        />
      ) : (
        <section style={{ display: "grid", gap: 16 }}>
          {matrixData.map(([normaKey, items]) => (
            <div
              key={normaKey}
              style={{
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                overflow: "hidden",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  alignItems: isCompact ? "flex-start" : "center",
                  background: "#f8fafc",
                  borderBottom: "1px solid #e5e7eb",
                  display: isCompact ? "grid" : "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  justifyContent: "space-between",
                  padding: isCompact ? "12px 14px" : "14px 18px",
                }}
              >
                <h3 style={{ fontSize: 18, margin: 0 }}>{normaKey}</h3>
                <span style={{ color: "#6b7280", fontSize: 13, fontWeight: 600 }}>
                  {Object.keys(items).length} items
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                  padding: isCompact ? 12 : 18,
                }}
              >
                {Object.entries(items)
                  .sort(([left], [right]) => naturalTextCompare(left, right))
                  .map(([itemKey, itemRequirements]) => {
                    const completionPercent = getCompletionPercent(itemRequirements);
                    const matrixStatus = getMatrixStatus(completionPercent);

                    return (
                      <article
                        key={itemKey}
                        style={{
                          border: "1px solid #eef2f7",
                          borderRadius: 10,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            alignItems: isCompact ? "start" : "center",
                            background: "#fcfcfd",
                            borderBottom: "1px solid #eef2f7",
                            display: "grid",
                            gap: 12,
                            gridTemplateColumns: isCompact
                              ? "minmax(0, 1fr)"
                              : "minmax(0, 1fr) auto auto",
                            padding: "12px 14px",
                          }}
                        >
                          <div>
                            <strong style={{ color: "#111827", fontSize: 15 }}>
                              {itemKey}
                            </strong>
                            <div
                              style={{
                                color: "#6b7280",
                                fontSize: 13,
                                marginTop: 4,
                              }}
                            >
                              {itemRequirements.length} requerimientos asociados
                            </div>
                          </div>

                          <span
                            style={{
                              color: "#6b7280",
                              fontSize: 13,
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {completionPercent}% cumplimiento
                          </span>

                          <StatusBadge status={matrixStatus} />
                        </div>

                        <div
                          style={{
                            overflowX: "auto",
                            WebkitOverflowScrolling: "touch",
                          }}
                        >
                          <table
                            style={{
                              borderCollapse: "collapse",
                              minWidth: isCompact ? 760 : 920,
                              width: "100%",
                            }}
                          >
                            <thead>
                              <tr style={{ background: "#ffffff" }}>
                                <th style={tableHeaderStyle}>Requerimiento</th>
                                <th style={tableHeaderStyle}>Evidencia</th>
                                <th style={tableHeaderStyle}>Estado</th>
                                <th style={tableHeaderStyle}>Fecha límite</th>
                                <th style={tableHeaderStyle}>Analítica</th>
                              </tr>
                            </thead>
                            <tbody>
                              {itemRequirements
                                .slice()
                                .sort((left, right) =>
                                  naturalTextCompare(
                                    getDisplayValue(left.name, "Sin descripción"),
                                    getDisplayValue(right.name, "Sin descripción")
                                  )
                                )
                                .map((requirement) => {
                                  const status = normalizeStatus(requirement.status);
                                  const deadlineState = getDeadlineState(requirement);

                                  return (
                                    <tr key={requirement.id}>
                                      <td style={tableCellStyle}>
                                        <div
                                          style={{
                                            color: "#111827",
                                            fontSize: 14,
                                            fontWeight: 600,
                                            lineHeight: 1.5,
                                          }}
                                        >
                                          {getDisplayValue(
                                            requirement.name,
                                            "Sin descripción"
                                          )}
                                        </div>
                                      </td>
                                      <td style={tableCellStyle}>
                                        <span
                                          style={{
                                            color: "#4b5563",
                                            fontSize: 13,
                                            lineHeight: 1.5,
                                          }}
                                        >
                                          {getDisplayValue(
                                            requirement.evidencia,
                                            "Sin evidencia"
                                          )}
                                        </span>
                                      </td>
                                      <td style={{ ...tableCellStyle, width: 160 }}>
                                        <StatusBadge status={status} />
                                      </td>
                                      <td style={{ ...tableCellStyle, width: 160 }}>
                                        <span
                                          style={{
                                            color: deadlineState.textColor,
                                            fontSize: 13,
                                            fontWeight: 600,
                                          }}
                                        >
                                          {formatDate(requirement.deadline)}
                                        </span>
                                      </td>
                                      <td style={{ ...tableCellStyle, width: 180 }}>
                                        <DeadlineBadge state={deadlineState} />
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </article>
                    );
                  })}
              </div>
            </div>
          ))}
        </section>
      )}
    </section>
  );
}

function getCompletionPercent(requirements: Requirement[]) {
  if (requirements.length === 0) return 0;

  const score = requirements.reduce((sum, requirement) => {
    const status = normalizeStatus(requirement.status);

    if (status === "total") return sum + 1;
    if (status === "parcial") return sum + 0.5;
    return sum;
  }, 0);

  return Math.round((score / requirements.length) * 100);
}

function getMatrixStatus(percent: number): RequirementStatus {
  if (percent === 100) return "total";
  if (percent > 0) return "parcial";
  return "no_conforme";
}

function getDeadlineState(requirement: Requirement) {
  if (!requirement.deadline) {
    return {
      label: "Sin fecha",
      symbol: "○",
      textColor: "#6b7280",
      background: "#f3f4f6",
      border: "#d1d5db",
    };
  }

  if (isRequirementOverdue(requirement)) {
    return {
      label: "Vencido",
      symbol: "●",
      textColor: "#b91c1c",
      background: "#fee2e2",
      border: "#fca5a5",
    };
  }

  if (isRequirementUpcoming(requirement)) {
    return {
      label: "Próximo",
      symbol: "●",
      textColor: "#c2410c",
      background: "#ffedd5",
      border: "#fdba74",
    };
  }

  return {
    label: "En plazo",
    symbol: "●",
    textColor: "#475569",
    background: "#f8fafc",
    border: "#cbd5e1",
  };
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ color: "#6b7280", fontSize: 12 }}>{label}</div>
      <div
        style={{
          color: accent || "#111827",
          fontSize: 24,
          fontWeight: 700,
          marginTop: 6,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  label,
}: {
  status: RequirementStatus;
  label?: string;
}) {
  const meta = STATUS_META[status];

  return (
    <span
      style={{
        background: meta.background,
        border: `1px solid ${meta.border}`,
        borderRadius: 999,
        color: meta.color,
        display: "inline-flex",
        fontSize: 12,
        fontWeight: 700,
        padding: "5px 10px",
        whiteSpace: "nowrap",
      }}
    >
      {label || meta.label}
    </span>
  );
}

function DeadlineBadge({
  state,
}: {
  state: ReturnType<typeof getDeadlineState>;
}) {
  return (
    <span
      style={{
        alignItems: "center",
        background: state.background,
        border: `1px solid ${state.border}`,
        borderRadius: 999,
        color: state.textColor,
        display: "inline-flex",
        fontSize: 12,
        fontWeight: 700,
        gap: 6,
        padding: "5px 10px",
        whiteSpace: "nowrap",
      }}
    >
      <span>{state.symbol}</span>
      {state.label}
    </span>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "1px dashed #d1d5db",
        borderRadius: 12,
        color: "#6b7280",
        padding: 24,
        textAlign: "center",
      }}
    >
      <strong style={{ color: "#374151" }}>{title}</strong>
      <p style={{ margin: "6px 0 0" }}>{description}</p>
    </div>
  );
}

function useMatrixBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<"compact" | "regular">("regular");

  useEffect(() => {
    const updateBreakpoint = () => {
      setBreakpoint(window.innerWidth < 760 ? "compact" : "regular");
    };

    updateBreakpoint();
    window.addEventListener("resize", updateBreakpoint);

    return () => {
      window.removeEventListener("resize", updateBreakpoint);
    };
  }, []);

  return breakpoint;
}

const controlStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 8,
  minHeight: 40,
  padding: "8px 10px",
};

const filterLabelStyle: React.CSSProperties = {
  color: "#374151",
  display: "grid",
  fontSize: 13,
  fontWeight: 700,
  gap: 8,
};

const secondaryButtonStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  color: "#111827",
  cursor: "pointer",
  fontWeight: 700,
  minHeight: 40,
  padding: "9px 14px",
};

const tableHeaderStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  color: "#6b7280",
  fontSize: 12,
  fontWeight: 700,
  padding: "12px 14px",
  textAlign: "left",
  textTransform: "uppercase",
};

const tableCellStyle: React.CSSProperties = {
  borderTop: "1px solid #f3f4f6",
  padding: "12px 14px",
  verticalAlign: "top",
};

