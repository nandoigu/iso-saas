"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/EmptyState";
import { Notice, type NoticeTone } from "@/components/Notice";
import {
  appPanelStyle,
  appPrimaryButtonStyle,
  appSecondaryButtonStyle,
  getActionStateStyle,
} from "@/components/uiStyles";

type RequirementStatus = "total" | "parcial" | "no_conforme";
type DateFilter = "all" | "overdue" | "upcoming" | "not_overdue" | "no_date";

type Requirement = {
  id: string;
  norma?: string | null;
  item?: string | null;
  name: string;
  evidencia?: string | null;
  status?: RequirementStatus | string | null;
  deadline?: string | Date | null;
  projectId?: string | null;
};

type Project = {
  id: string;
  name: string;
  code?: string | null;
  userId?: string;
  requirements?: Requirement[];
};

type DashboardRequirement = Requirement & {
  projectId: string;
  projectName: string;
};

type DashboardMetrics = {
  totalProjects: number;
  totalRequirements: number;
  compliance: number;
  overdue: number;
};

type DashboardImagePage = {
  dataUrl: string;
  height: number;
};

type NotificationPreferences = {
  notifyAlerts: boolean;
  notifyReports: boolean;
  reportFrequency: "daily" | "weekly";
};

type FeedbackMessage = {
  tone: NoticeTone;
  text: string;
};

type DashboardFilters = {
  norma: string;
  status: "all" | RequirementStatus;
  projectId: string;
  date: DateFilter;
};

const EMPTY_FILTERS: DashboardFilters = {
  norma: "all",
  status: "all",
  projectId: "all",
  date: "all",
};
const DASHBOARD_FILTERS_STORAGE_KEY = "bmo:dashboard-filters";

const STATUS_META: Record<
  RequirementStatus,
  { label: string; color: string; score: number }
> = {
  total: { label: "Total", color: "#16a34a", score: 1 },
  parcial: { label: "Parcial", color: "#f59e0b", score: 0.5 },
  no_conforme: { label: "No conforme", color: "#ef4444", score: 0 },
};

const CHART_TEXT = "#64748b";
const GRID = "#e5e7eb";
const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  notifyAlerts: true,
  notifyReports: false,
  reportFrequency: "weekly",
};

export default function DashboardPage() {
  const router = useRouter();
  const reportContentRef = useRef<HTMLDivElement>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<FeedbackMessage | null>(null);
  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_FILTERS);
  const [filtersHydrated, setFiltersHydrated] = useState(false);

  useEffect(() => {
    fetch("/api/projects", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          await fetch("/api/auth/logout", { method: "POST" });
          router.replace("/login?next=/dashboard");
          return null;
        }

        if (!res.ok) {
          throw new Error("No se pudo cargar el dashboard");
        }

        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setProjects(Array.isArray(data) ? data : []);
        setError("");
      })
      .catch((err) => {
        console.error("Error cargando dashboard:", err);
        setProjects([]);
        setError("No se pudieron cargar los datos del dashboard.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DASHBOARD_FILTERS_STORAGE_KEY);
      const saved = raw ? JSON.parse(raw) : null;
      const nextFilters: DashboardFilters = {
        norma:
          typeof saved?.norma === "string" && saved.norma.trim()
            ? saved.norma
            : EMPTY_FILTERS.norma,
        status: isRequirementStatus(saved?.status) ? saved.status : "all",
        projectId:
          typeof saved?.projectId === "string" && saved.projectId.trim()
            ? saved.projectId
            : EMPTY_FILTERS.projectId,
        date: isDateFilter(saved?.date) ? saved.date : "all",
      };

      const queryParams = new URLSearchParams(window.location.search);
      const queryProjectId = queryParams.get("projectId");
      const queryNorma = queryParams.get("norma");
      const queryStatus = queryParams.get("status");
      const queryDate = queryParams.get("date");

      if (queryProjectId) nextFilters.projectId = queryProjectId;
      if (queryNorma) nextFilters.norma = queryNorma;
      if (isRequirementStatus(queryStatus)) nextFilters.status = queryStatus;
      if (isDateFilter(queryDate)) nextFilters.date = queryDate;

      setFilters(nextFilters);
    } catch (error) {
      console.error("Error recuperando filtros del dashboard:", error);
    } finally {
      setFiltersHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!filtersHydrated) return;
    window.localStorage.setItem(DASHBOARD_FILTERS_STORAGE_KEY, JSON.stringify(filters));
  }, [filters, filtersHydrated]);

  useEffect(() => {
    fetch("/api/notifications/preferences", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (!data?.data) return;
        setNotificationPreferences({
          notifyAlerts: Boolean(data.data.notifyAlerts),
          notifyReports: Boolean(data.data.notifyReports),
          reportFrequency:
            data.data.reportFrequency === "daily" ? "daily" : "weekly",
        });
      })
      .catch((err) => {
        console.error("Error cargando preferencias:", err);
      });
  }, []);

  const allRequirements = useMemo(() => flattenRequirements(projects), [projects]);

  const filterOptions = useMemo(() => {
    return {
      normas: Array.from(
        new Set(
          allRequirements
            .map((requirement) => requirement.norma?.trim())
            .filter((value): value is string => Boolean(value))
        )
      ).sort(naturalCompare),
      projects: [...projects].sort((a, b) => naturalCompare(a.name, b.name)),
    };
  }, [allRequirements, projects]);

  const filteredRequirements = useMemo(() => {
    return allRequirements.filter((requirement) => {
      const status = normalizeStatus(requirement.status);
      const norma = getDisplayValue(requirement.norma, "Sin norma");

      if (filters.norma !== "all" && norma !== filters.norma) return false;
      if (filters.status !== "all" && status !== filters.status) return false;
      if (filters.projectId !== "all" && requirement.projectId !== filters.projectId) {
        return false;
      }
      if (!matchesDateFilter(requirement, filters.date)) return false;

      return true;
    });
  }, [allRequirements, filters]);

  const dashboardData = useMemo(() => {
    return buildDashboardData(projects, filteredRequirements);
  }, [projects, filteredRequirements]);

  const alertRequirements = useMemo(() => {
    return buildAlertRequirements(allRequirements);
  }, [allRequirements]);

  const activeFilterCount =
    (filters.norma !== "all" ? 1 : 0) +
    (filters.status !== "all" ? 1 : 0) +
    (filters.projectId !== "all" ? 1 : 0) +
    (filters.date !== "all" ? 1 : 0);

  const updateFilter = <K extends keyof DashboardFilters>(
    key: K,
    value: DashboardFilters[K]
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const exportCsv = () => {
    const headers = [
      "Proyecto",
      "Norma",
      "Item",
      "Requerimiento",
      "Evidencia",
      "Estado",
      "Fecha límite",
      "Vencido",
    ];

    const rows = filteredRequirements.map((requirement) => [
      requirement.projectName,
      requirement.norma || "",
      requirement.item || "",
      requirement.name || "",
      requirement.evidencia || "",
      STATUS_META[normalizeStatus(requirement.status)].label,
      formatDate(requirement.deadline),
      isRequirementOverdue(requirement) ? "Sí" : "No",
    ]);

    const csv = ["sep=;", headers, ...rows]
      .map((row) =>
        Array.isArray(row)
          ? row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";")
          : row
      )
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = getDashboardExportFilename("csv");
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = async () => {
    if (filteredRequirements.length === 0 || generatingPdf) return;

    setGeneratingPdf(true);

    try {
      const dashboardImages = reportContentRef.current
        ? await captureDashboardImages(reportContentRef.current)
        : null;
      const pdf = generatePDF({
        metrics: dashboardData.metrics,
        requirements: filteredRequirements,
        dashboardImages,
      });
      pdf.save(getDashboardExportFilename("pdf"));
    } finally {
      setGeneratingPdf(false);
    }
  };

  const updateNotificationPreferences = async (
    nextPreferences: NotificationPreferences
  ) => {
    setNotificationPreferences(nextPreferences);
    setSavingPreferences(true);
    setEmailFeedback(null);

    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextPreferences),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "No se pudieron guardar las preferencias");
      }

      setNotificationPreferences({
        notifyAlerts: Boolean(data.data.notifyAlerts),
        notifyReports: Boolean(data.data.notifyReports),
        reportFrequency:
          data.data.reportFrequency === "daily" ? "daily" : "weekly",
      });
      setEmailFeedback({
        tone: "success",
        text: "Preferencias de notificación guardadas correctamente.",
      });
    } catch (err) {
      setNotificationPreferences(notificationPreferences);
      setEmailFeedback({
        tone: "error",
        text:
          err instanceof Error
            ? err.message
            : "No se pudieron guardar las preferencias de notificación.",
      });
    } finally {
      setSavingPreferences(false);
    }
  };

  const sendManualReport = async () => {
    if (sendingReport) return;

    setSendingReport(true);
    setEmailFeedback(null);

    try {
      const res = await fetch("/api/cron/alerts", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "No se pudo enviar el informe");
      }

      setEmailFeedback({
        tone: "success",
        text:
          data.message ||
          `Informe enviado correctamente. Emails enviados: ${data.emailsSent ?? 1}.`,
      });
    } catch (err) {
      setEmailFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "No se pudo enviar el informe.",
      });
    } finally {
      setSendingReport(false);
    }
  };

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div style={heroCopyStyle}>
          <span style={eyebrowStyle}>Workspace ISO 19650</span>
          <h1 style={heroTitleStyle}>Dashboard BI</h1>
          <p style={heroDescriptionStyle}>
            Análisis interactivo de cumplimiento ISO 19650 por proyecto, norma y estado.
          </p>
        </div>

        <div style={heroActionsStyle}>
          <Link href="/dashboard/email-test" style={secondaryLinkStyle}>
            Probar email
          </Link>
          <button
            onClick={downloadPDF}
            disabled={filteredRequirements.length === 0 || generatingPdf}
            aria-disabled={filteredRequirements.length === 0 || generatingPdf}
            style={{
              ...secondaryButtonStyle,
              ...getActionStateStyle(
                filteredRequirements.length === 0 || generatingPdf
              ),
            }}
          >
            {generatingPdf ? "Generando PDF..." : "Exportar a PDF"}
          </button>
          <button onClick={exportCsv} style={secondaryButtonStyle}>
            Exportar CSV
          </button>
          <Link href="/projects" style={primaryLinkStyle}>
            Gestionar proyectos
          </Link>
        </div>
      </section>

      {error && <Notice tone="error" message={error} style={{ marginBottom: 20 }} />}
      {loading && <EmptyState title="Cargando dashboard" description="Preparando metricas y graficos." />}

      {!loading && !error && (
        <>
          <FiltersPanel
            filters={filters}
            options={filterOptions}
            activeFilterCount={activeFilterCount}
            resultCount={filteredRequirements.length}
            totalCount={allRequirements.length}
            onChange={updateFilter}
            onReset={() => setFilters(EMPTY_FILTERS)}
          />

          <AlertsPanel
            alertRequirements={alertRequirements}
            preferences={notificationPreferences}
            savingPreferences={savingPreferences}
            sendingReport={sendingReport}
            feedback={emailFeedback}
            onPreferencesChange={updateNotificationPreferences}
            onSendReport={sendManualReport}
          />

          <div ref={reportContentRef}>
            <KPISection metrics={dashboardData.metrics} />

            {projects.length === 0 ? (
              <EmptyState title="No hay proyectos" description="Crea un proyecto para empezar a visualizar datos." />
            ) : (
              <ChartsSection
                data={dashboardData}
                filters={filters}
                onStatusClick={(status) => updateFilter("status", status)}
                onNormaClick={(norma) => updateFilter("norma", norma)}
                onProjectClick={(projectId) => updateFilter("projectId", projectId)}
                onDateClick={(date) => updateFilter("date", date)}
              />
            )}
          </div>
        </>
      )}
    </main>
  );
}

function FiltersPanel({
  filters,
  options,
  activeFilterCount,
  resultCount,
  totalCount,
  onChange,
  onReset,
}: {
  filters: DashboardFilters;
  options: { normas: string[]; projects: Project[] };
  activeFilterCount: number;
  resultCount: number;
  totalCount: number;
  onChange: <K extends keyof DashboardFilters>(
    key: K,
    value: DashboardFilters[K]
  ) => void;
  onReset: () => void;
}) {
  return (
    <section style={panelStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, margin: 0 }}>Filtros globales</h2>
          <p style={{ color: "#64748b", fontSize: 13, margin: "6px 0 0" }}>
            {resultCount} de {totalCount} requerimientos visibles
            {activeFilterCount > 0 ? ` - ${activeFilterCount} filtros activos` : ""}
            {" · filtros recordados"}
          </p>
        </div>

        <button
          onClick={onReset}
          disabled={activeFilterCount === 0}
          aria-disabled={activeFilterCount === 0}
          style={{
            ...secondaryButtonStyle,
            ...getActionStateStyle(activeFilterCount === 0),
          }}
        >
          Limpiar filtros
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
        }}
      >
        <SelectFilter
          label="Norma"
          value={filters.norma}
          onChange={(value) => onChange("norma", value)}
          options={[
            { value: "all", label: "Todas" },
            ...options.normas.map((norma) => ({ value: norma, label: norma })),
          ]}
        />

        <SelectFilter
          label="Estado"
          value={filters.status}
          onChange={(value) => onChange("status", value as DashboardFilters["status"])}
          options={[
            { value: "all", label: "Todos" },
            { value: "total", label: "Total" },
            { value: "parcial", label: "Parcial" },
            { value: "no_conforme", label: "No conforme" },
          ]}
        />

        <SelectFilter
          label="Proyecto"
          value={filters.projectId}
          onChange={(value) => onChange("projectId", value)}
          options={[
            { value: "all", label: "Todos" },
            ...options.projects.map((project) => ({
              value: project.id,
              label: project.name,
            })),
          ]}
        />

        <SelectFilter
          label="Fecha"
          value={filters.date}
          onChange={(value) => onChange("date", value as DateFilter)}
          options={[
            { value: "all", label: "Todas" },
            { value: "overdue", label: "Vencidos" },
            { value: "upcoming", label: "Próximos 7 días" },
            { value: "not_overdue", label: "No vencidos" },
            { value: "no_date", label: "Sin fecha" },
          ]}
        />
      </div>
    </section>
  );
}

function AlertsPanel({
  alertRequirements,
  preferences,
  savingPreferences,
  sendingReport,
  feedback,
  onPreferencesChange,
  onSendReport,
}: {
  alertRequirements: ReturnType<typeof buildAlertRequirements>;
  preferences: NotificationPreferences;
  savingPreferences: boolean;
  sendingReport: boolean;
  feedback: FeedbackMessage | null;
  onPreferencesChange: (preferences: NotificationPreferences) => void;
  onSendReport: () => void;
}) {
  const highlightedRequirements = [
    ...alertRequirements.overdue,
    ...alertRequirements.upcoming,
  ].slice(0, 6);

  return (
    <section style={panelStyle}>
      <div
        style={{
          display: "grid",
          gap: 18,
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)",
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, margin: 0 }}>Alertas de vencimiento</h2>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              marginTop: 14,
            }}
          >
            <AlertCounter
              label="Vencidos"
              value={alertRequirements.overdue.length}
              color="#dc2626"
            />
            <AlertCounter
              label="Próximos 7 días"
              value={alertRequirements.upcoming.length}
              color="#d97706"
            />
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            {highlightedRequirements.length === 0 ? (
              <p style={{ color: "#15803d", fontWeight: 500, margin: 0 }}>
                No hay requerimientos vencidos ni próximos a vencer.
              </p>
            ) : (
              highlightedRequirements.map((requirement) => (
                <div
                  key={requirement.id}
                  style={{
                    border: "1px solid #fee2e2",
                    borderLeft: `3px solid ${
                      isRequirementOverdue(requirement) ? "#dc2626" : "#d97706"
                    }`,
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <strong style={{ display: "block", fontSize: 14, fontWeight: 600 }}>
                    {requirement.projectName}
                  </strong>
                  <span style={{ color: "#64748b", display: "block", fontSize: 13 }}>
                    {getDisplayValue(requirement.norma, "Sin norma")} /{" "}
                    {getDisplayValue(requirement.item, "Sin item")} -{" "}
                    {formatDate(requirement.deadline)}
                  </span>
                  <span style={{ display: "block", marginTop: 4 }}>
                    {requirement.name}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: 16,
          }}
        >
          <h3 style={panelTitleStyle}>Notificaciones</h3>
          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={preferences.notifyAlerts}
              onChange={(event) =>
                onPreferencesChange({
                  ...preferences,
                  notifyAlerts: event.target.checked,
                })
              }
            />
            Alertas de vencimiento por email
          </label>

          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={preferences.notifyReports}
              onChange={(event) =>
                onPreferencesChange({
                  ...preferences,
                  notifyReports: event.target.checked,
                })
              }
            />
            Informes periódicos por email
          </label>

          <label style={{ display: "grid", gap: 8, marginTop: 12 }}>
            <span style={{ color: "#334155", fontSize: 13, fontWeight: 600 }}>
              Frecuencia
            </span>
            <select
              value={preferences.reportFrequency}
              onChange={(event) =>
                onPreferencesChange({
                  ...preferences,
                  reportFrequency:
                    event.target.value === "daily" ? "daily" : "weekly",
                })
              }
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                minHeight: 40,
                padding: "8px 10px",
              }}
            >
              <option value="daily">Diaria</option>
              <option value="weekly">Semanal</option>
            </select>
          </label>

          <button
            onClick={onSendReport}
            disabled={sendingReport}
            aria-disabled={sendingReport}
            style={{
              ...primaryButtonStyle,
              ...getActionStateStyle(sendingReport),
              marginTop: 14,
              width: "100%",
            }}
          >
            {sendingReport ? "Enviando informe..." : "Enviar informe ahora"}
          </button>

          {sendingReport ? (
            <Notice
              tone="info"
              message="Enviando informe al email configurado..."
              compact
              style={{ marginTop: 12 }}
            />
          ) : savingPreferences ? (
            <Notice
              tone="info"
              message="Guardando preferencias de notificación..."
              compact
              style={{ marginTop: 12 }}
            />
          ) : feedback ? (
            <Notice
              tone={feedback.tone}
              message={feedback.text}
              compact
              style={{ marginTop: 12 }}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function AlertCounter({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        padding: 14,
      }}
    >
      <span style={{ color: "#64748b", display: "block", fontSize: 13 }}>
        {label}
      </span>
      <strong style={{ color, display: "block", fontSize: 24, fontWeight: 600, marginTop: 4 }}>
        {value}
      </strong>
    </div>
  );
}

function KPISection({
  metrics,
}: {
  metrics: DashboardMetrics;
}) {
  return (
    <section
      style={{
        display: "grid",
        gap: 16,
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        marginBottom: 20,
      }}
    >
      <KpiCard label="Proyectos" value={metrics.totalProjects} />
      <KpiCard label="Requerimientos" value={metrics.totalRequirements} />
      <KpiCard label="Cumplimiento global" value={`${metrics.compliance}%`} />
      <KpiCard label="Vencidos" value={metrics.overdue} tone="risk" />
    </section>
  );
}

function ChartsSection({
  data,
  filters,
  onStatusClick,
  onNormaClick,
  onProjectClick,
  onDateClick,
}: {
  data: ReturnType<typeof buildDashboardData>;
  filters: DashboardFilters;
  onStatusClick: (status: RequirementStatus) => void;
  onNormaClick: (norma: string) => void;
  onProjectClick: (projectId: string) => void;
  onDateClick: (date: DateFilter) => void;
}) {
  return (
    <section style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
        }}
      >
        <ChartPanel title="Distribucion de cumplimiento">
          <ResponsiveContainer width="100%" height={compactChartHeight}>
            <BarChart data={data.statusData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: CHART_TEXT, fontSize: 11 }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: CHART_TEXT, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="value" name="Requerimientos" radius={[6, 6, 0, 0]} maxBarSize={64}>
                {data.statusData.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={entry.color}
                    cursor="pointer"
                    opacity={filters.status === "all" || filters.status === entry.status ? 1 : 0.35}
                    onClick={() => onStatusClick(entry.status)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Requerimientos por estado">
          <ResponsiveContainer width="100%" height={compactChartHeight}>
            <PieChart>
              <Pie
                data={data.statusData}
                dataKey="value"
                nameKey="label"
                innerRadius={46}
                outerRadius={78}
                paddingAngle={4}
              >
                {data.statusData.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={entry.color}
                    cursor="pointer"
                    opacity={filters.status === "all" || filters.status === entry.status ? 1 : 0.35}
                    onClick={() => onStatusClick(entry.status)}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
        }}
      >
        <ChartPanel title="Cumplimiento por norma">
          <ResponsiveContainer width="100%" height={mediumChartHeight}>
            <BarChart data={data.normaComplianceData} margin={{ top: 8, left: -8, right: 12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="norma" tick={{ fill: CHART_TEXT, fontSize: 11 }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: CHART_TEXT, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value) => `${value}%`} />
              <Bar dataKey="compliance" name="% cumplimiento" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={56}>
                {data.normaComplianceData.map((entry) => (
                  <Cell
                    key={entry.norma}
                    cursor="pointer"
                    fill={getComplianceColor(entry.compliance)}
                    opacity={filters.norma === "all" || filters.norma === entry.norma ? 1 : 0.35}
                    onClick={() => onNormaClick(entry.norma)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Vencimientos">
          <ResponsiveContainer width="100%" height={mediumChartHeight}>
            <LineChart data={data.deadlineData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: CHART_TEXT, fontSize: 11 }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: CHART_TEXT, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="value"
                name="Requerimientos"
                stroke="#2563eb"
                strokeWidth={3}
                dot={({ cx, cy, payload }) => (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={6}
                    fill={payload.color}
                    stroke="white"
                    strokeWidth={2}
                    cursor="pointer"
                    onClick={() => onDateClick(payload.filter)}
                  />
                )}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <ChartPanel title="Proyectos por cumplimiento">
        <ResponsiveContainer width="100%" height={wideChartHeight}>
          <BarChart
            data={data.projectComplianceData}
            layout="vertical"
            margin={{ top: 8, left: 8, right: 20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: CHART_TEXT, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              tick={{ fill: CHART_TEXT, fontSize: 11 }}
              tickLine={false}
            />
            <Tooltip formatter={(value) => `${value}%`} />
            <Bar dataKey="compliance" name="% cumplimiento" radius={[0, 6, 6, 0]} maxBarSize={34}>
              {data.projectComplianceData.map((entry) => (
                <Cell
                  key={entry.projectId}
                  fill={getComplianceColor(entry.compliance)}
                  cursor="pointer"
                  opacity={filters.projectId === "all" || filters.projectId === entry.projectId ? 1 : 0.35}
                  onClick={() => onProjectClick(entry.projectId)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>
    </section>
  );
}

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ color: "#334155", display: "grid", fontSize: 13, fontWeight: 600, gap: 8 }}>
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          minHeight: 40,
          padding: "8px 10px",
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function KpiCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "risk";
}) {
  return (
    <div style={panelStyle}>
      <div style={{ color: "#64748b", fontSize: 13 }}>{label}</div>
      <div
        style={{
          color: tone === "risk" ? "#dc2626" : "#0f172a",
          fontSize: 24,
          fontWeight: 600,
          marginTop: 8,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ChartPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={chartPanelStyle}>
      <h3 style={chartTitleStyle}>{title}</h3>
      {children}
    </section>
  );
}

async function captureDashboardImages(element: HTMLElement): Promise<DashboardImagePage[]> {
  const canvas = await html2canvas(element, {
    backgroundColor: "#f8fafc",
    scale: Math.min(window.devicePixelRatio || 1, 2),
    useCORS: true,
  });

  const imageWidth = 269;
  const firstPageMaxHeight = 112;
  const nextPageMaxHeight = 164;
  const pixelsPerMillimeter = canvas.width / imageWidth;
  const pages: DashboardImagePage[] = [];
  let offset = 0;
  let firstPage = true;

  while (offset < canvas.height) {
    const maxHeight = firstPage ? firstPageMaxHeight : nextPageMaxHeight;
    const sliceHeight = Math.min(
      canvas.height - offset,
      Math.floor(maxHeight * pixelsPerMillimeter)
    );
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceHeight;

    const context = slice.getContext("2d");
    if (!context) break;

    context.drawImage(
      canvas,
      0,
      offset,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight
    );

    pages.push({
      dataUrl: slice.toDataURL("image/png"),
      height: sliceHeight / pixelsPerMillimeter,
    });

    offset += sliceHeight;
    firstPage = false;
  }

  return pages;
}

function generatePDF({
  metrics,
  requirements,
  dashboardImages,
}: {
  metrics: DashboardMetrics;
  requirements: DashboardRequirement[];
  dashboardImages: DashboardImagePage[] | null;
}) {
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const generatedAt = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());
  const tableRows = formatTableData(requirements);
  const riskLabel =
    metrics.overdue > 0
      ? `${metrics.overdue} vencidos requieren atención`
      : "Sin vencimientos activos";

  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, 297, 28, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text("BMO ISO 19650", 14, 12);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "normal");
  pdf.text("Informe de Cumplimiento ISO 19650", 14, 20);
  pdf.text(`Generado: ${generatedAt}`, 225, 20, { align: "left" });
  pdf.setTextColor(71, 85, 105);
  pdf.setFontSize(9);
  pdf.text(`Alcance: ${requirements.length} requerimientos filtrados · ${riskLabel}`, 14, 32);

  const summaryCards = [
    { label: "Proyectos", value: String(metrics.totalProjects) },
    { label: "Requerimientos", value: String(metrics.totalRequirements) },
    { label: "Cumplimiento global", value: `${metrics.compliance}%` },
    { label: "Vencidos", value: String(metrics.overdue) },
  ];

  summaryCards.forEach((card, index) => {
    const x = 14 + index * 68;
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(x, 40, 58, 22, 2, 2, "FD");
    pdf.setTextColor(100, 116, 139);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.text(card.label, x + 4, 48);
    pdf.setTextColor(index === 3 ? 220 : 15, index === 3 ? 38 : 23, index === 3 ? 38 : 42);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(card.value, x + 4, 57);
  });

  if (dashboardImages && dashboardImages.length > 0) {
    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("Resumen visual del dashboard filtrado", 14, 74);

    dashboardImages.forEach((image, index) => {
      if (index > 0) {
        pdf.addPage();
        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("Resumen visual del dashboard filtrado", 14, 18);
      }

      pdf.addImage(
        image.dataUrl,
        "PNG",
        14,
        index === 0 ? 80 : 24,
        269,
        image.height,
        undefined,
        "FAST"
      );
    });

    pdf.addPage();
  }

  const hasDashboardImages = Boolean(dashboardImages && dashboardImages.length > 0);
  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Tabla de requerimientos filtrados", 14, hasDashboardImages ? 20 : 70);

  autoTable(pdf, {
    startY: hasDashboardImages ? 26 : 76,
    head: [
      [
        "Proyecto",
        "Norma",
        "Item",
        "Requerimiento",
        "Evidencia",
        "Estado",
      "Fecha límite",
        "Vencido",
      ],
    ],
    body: tableRows.map((row) => [
      row.project,
      row.norma,
      row.item,
      row.name,
      row.evidence,
      row.statusLabel,
      row.deadline,
      row.overdue,
    ]),
    styles: {
      font: "helvetica",
      fontSize: 7,
      cellPadding: 2,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 34 },
      1: { cellWidth: 24 },
      2: { cellWidth: 18 },
      3: { cellWidth: 70 },
      4: { cellWidth: 56 },
      5: { cellWidth: 24 },
      6: { cellWidth: 24 },
      7: { cellWidth: 18 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index !== 5) return;

      const status = tableRows[data.row.index]?.status;
      if (!status) return;

      const color = STATUS_META[status].color;
      data.cell.styles.textColor = hexToRgb(color);
      data.cell.styles.fontStyle = "bold";
    },
  });

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text("Generado por BMO ISO 19650 SaaS", 14, 202);
    pdf.text(`Pagina ${page} de ${pageCount}`, 283, 202, { align: "right" });
  }

  return pdf;
}

function getDashboardExportFilename(extension: "csv" | "pdf") {
  const today = new Date().toISOString().slice(0, 10);
  return `informe_iso_19650_${today}.${extension}`;
}

function formatTableData(requirements: DashboardRequirement[]) {
  return requirements.map((requirement) => {
    const status = normalizeStatus(requirement.status);

    return {
      project: getDisplayValue(requirement.projectName, "Sin proyecto"),
      norma: getDisplayValue(requirement.norma, "Sin norma"),
      item: getDisplayValue(requirement.item, "Sin item"),
      name: getDisplayValue(requirement.name, "Sin descripción"),
      evidence: getDisplayValue(requirement.evidencia, "Sin evidencia"),
      status,
      statusLabel: STATUS_META[status].label,
      deadline: formatDate(requirement.deadline),
      overdue: isRequirementOverdue(requirement) ? "Si" : "No",
    };
  });
}

function buildDashboardData(projects: Project[], requirements: DashboardRequirement[]) {
  const totalScore = requirements.reduce(
    (sum, requirement) => sum + STATUS_META[normalizeStatus(requirement.status)].score,
    0
  );

  const statusData = (Object.keys(STATUS_META) as RequirementStatus[]).map((status) => ({
    status,
    label: STATUS_META[status].label,
    value: requirements.filter((requirement) => normalizeStatus(requirement.status) === status).length,
    color: STATUS_META[status].color,
  }));

  const normaComplianceData = Array.from(
    requirements.reduce((map, requirement) => {
      const norma = getDisplayValue(requirement.norma, "Sin norma");
      const current = map.get(norma) || { norma, count: 0, score: 0 };
      current.count += 1;
      current.score += STATUS_META[normalizeStatus(requirement.status)].score;
      map.set(norma, current);
      return map;
    }, new Map<string, { norma: string; count: number; score: number }>())
  )
    .map(([, value]) => ({
      norma: value.norma,
      compliance: value.count > 0 ? Math.round((value.score / value.count) * 100) : 0,
      requirements: value.count,
    }))
    .sort((a, b) => naturalCompare(a.norma, b.norma));

  const projectComplianceData = projects
    .map((project) => {
      const projectRequirements = requirements.filter(
        (requirement) => requirement.projectId === project.id
      );
      const score = projectRequirements.reduce(
        (sum, requirement) => sum + STATUS_META[normalizeStatus(requirement.status)].score,
        0
      );

      return {
        projectId: project.id,
        name: project.name,
        requirements: projectRequirements.length,
        compliance:
          projectRequirements.length > 0
            ? Math.round((score / projectRequirements.length) * 100)
            : 0,
      };
    })
    .filter((project) => project.requirements > 0)
    .sort((a, b) => a.compliance - b.compliance);

  const overdue = requirements.filter(isRequirementOverdue).length;
  const noDate = requirements.filter((requirement) => !requirement.deadline).length;
  const notOverdue = requirements.length - overdue - noDate;

  return {
    metrics: {
      totalProjects: new Set(requirements.map((requirement) => requirement.projectId)).size,
      totalRequirements: requirements.length,
      compliance:
        requirements.length > 0 ? Math.round((totalScore / requirements.length) * 100) : 0,
      overdue,
    },
    statusData,
    normaComplianceData,
    projectComplianceData,
    deadlineData: [
      { label: "Vencidos", value: overdue, filter: "overdue" as DateFilter, color: "#ef4444" },
      { label: "No vencidos", value: notOverdue, filter: "not_overdue" as DateFilter, color: "#16a34a" },
      { label: "Sin fecha", value: noDate, filter: "no_date" as DateFilter, color: "#94a3b8" },
    ],
  };
}

function flattenRequirements(projects: Project[]): DashboardRequirement[] {
  return projects.flatMap((project) =>
    (project.requirements || []).map((requirement) => ({
      ...requirement,
      projectId: project.id,
      projectName: project.name,
    }))
  );
}

function buildAlertRequirements(requirements: DashboardRequirement[]) {
  return {
    overdue: requirements
      .filter(isRequirementOverdue)
      .sort((a, b) => compareDeadline(a.deadline, b.deadline)),
    upcoming: requirements
      .filter((requirement) => isRequirementUpcoming(requirement))
      .sort((a, b) => compareDeadline(a.deadline, b.deadline)),
  };
}

function normalizeStatus(status?: RequirementStatus | string | null): RequirementStatus {
  if (status === "total" || status === "parcial" || status === "no_conforme") {
    return status;
  }

  return "no_conforme";
}

function isRequirementStatus(value: unknown): value is RequirementStatus {
  return value === "total" || value === "parcial" || value === "no_conforme";
}

function isDateFilter(value: unknown): value is DateFilter {
  return (
    value === "all" ||
    value === "overdue" ||
    value === "upcoming" ||
    value === "not_overdue" ||
    value === "no_date"
  );
}

function getDisplayValue(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "Sin fecha";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function compareDeadline(
  left: string | Date | null | undefined,
  right: string | Date | null | undefined
) {
  const leftDate = left ? new Date(left).getTime() : Number.POSITIVE_INFINITY;
  const rightDate = right ? new Date(right).getTime() : Number.POSITIVE_INFINITY;

  return leftDate - rightDate;
}

function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace("#", "");
  const value = Number.parseInt(cleanHex, 16);

  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function matchesDateFilter(requirement: Requirement, filter: DateFilter) {
  if (filter === "all") return true;
  if (!requirement.deadline) return filter === "no_date";

  const deadline = new Date(requirement.deadline);
  if (Number.isNaN(deadline.getTime())) return filter === "no_date";

  const overdue = isRequirementOverdue(requirement);
  if (filter === "overdue") return overdue;
  if (filter === "upcoming") return isRequirementUpcoming(requirement);
  if (filter === "not_overdue") return !overdue;

  return false;
}

function isRequirementOverdue(requirement: Requirement) {
  if (!requirement.deadline || normalizeStatus(requirement.status) === "total") {
    return false;
  }

  const deadline = new Date(requirement.deadline);
  if (Number.isNaN(deadline.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return deadline < today;
}

function isRequirementUpcoming(requirement: Requirement) {
  if (!requirement.deadline || normalizeStatus(requirement.status) === "total") {
    return false;
  }

  const deadline = new Date(requirement.deadline);
  if (Number.isNaN(deadline.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const limit = new Date(today);
  limit.setDate(limit.getDate() + 7);

  return deadline >= today && deadline <= limit;
}

function getComplianceColor(value: number) {
  if (value === 100) return "#16a34a";
  if (value >= 50) return "#f59e0b";
  return "#ef4444";
}

const naturalCollator = new Intl.Collator("es", {
  numeric: true,
  sensitivity: "base",
});

function naturalCompare(a: string, b: string) {
  return naturalCollator.compare(a, b);
}

const pageStyle: React.CSSProperties = {
  background: "#f4f6fc",
  minHeight: "calc(100vh - 65px)",
  padding: "28px clamp(20px, 3vw, 36px) 40px",
};

const heroStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "grid",
  gap: 20,
  gridTemplateColumns: "repeat(auto-fit, minmax(min(360px, 100%), 1fr))",
  margin: "0 auto 20px",
  maxWidth: 1360,
};

const heroCopyStyle: React.CSSProperties = {
  alignSelf: "center",
  display: "grid",
  gap: 10,
  minWidth: 0,
};

const eyebrowStyle: React.CSSProperties = {
  color: "#0025df",
  fontSize: 12,
  fontWeight: 650,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const heroTitleStyle: React.CSSProperties = {
  color: "#002a4e",
  fontSize: 28,
  fontWeight: 500,
  lineHeight: 1.16,
  margin: 0,
};

const heroDescriptionStyle: React.CSSProperties = {
  color: "#5b6b82",
  fontSize: 15,
  lineHeight: 1.5,
  margin: 0,
  maxWidth: 720,
};

const heroActionsStyle: React.CSSProperties = {
  alignSelf: "center",
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  justifySelf: "end",
  width: "100%",
};

const panelStyle: React.CSSProperties = {
  ...appPanelStyle,
  padding: 18,
};

const chartPanelStyle: React.CSSProperties = {
  ...appPanelStyle,
  padding: 14,
};

const chartTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 15,
  fontWeight: 600,
  margin: "0 0 10px",
};

const panelTitleStyle: React.CSSProperties = {
  color: "#002a4e",
  fontSize: 16,
  fontWeight: 500,
  margin: "0 0 12px",
};

const compactChartHeight = 220;
const mediumChartHeight = 240;
const wideChartHeight = 250;

const primaryLinkStyle: React.CSSProperties = {
  ...appPrimaryButtonStyle,
  display: "inline-flex",
  justifyContent: "center",
  minHeight: 40,
  padding: "8px 13px",
  textDecoration: "none",
};

const secondaryLinkStyle: React.CSSProperties = {
  ...appSecondaryButtonStyle,
  display: "inline-flex",
  justifyContent: "center",
  minHeight: 40,
  padding: "8px 13px",
  textDecoration: "none",
};

const primaryButtonStyle: React.CSSProperties = {
  ...appPrimaryButtonStyle,
  justifyContent: "center",
  minHeight: 40,
  padding: "8px 13px",
};

const secondaryButtonStyle: React.CSSProperties = {
  ...appSecondaryButtonStyle,
  justifyContent: "center",
  minHeight: 40,
  padding: "8px 13px",
};

const checkboxLabelStyle: React.CSSProperties = {
  alignItems: "center",
  color: "#334155",
  display: "flex",
  fontSize: 14,
  fontWeight: 600,
  gap: 8,
  marginTop: 10,
};
