"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PROJECT_ROLE,
  getProjectRoleBadgeStyle,
  getProjectRoleLabel,
  PROJECT_ROLE_VALUES,
  type ProjectRole,
} from "@/app/lib/projectRoles";

type RequirementStatus = "total" | "parcial" | "no_conforme";

type Requirement = {
  id: string;
  status?: RequirementStatus | string | null;
  deadline?: string | null;
};

type Project = {
  id: string;
  name: string;
  code?: string | null;
  role: string;
  createdAt?: string;
  requirements?: Requirement[];
};

type ImportResult = {
  imported: number;
  skippedDuplicates: number;
  totalRows: number;
};

export default function ProjectsPage() {
  const router = useRouter();
  const breakpoint = useProjectsBreakpoint();
  const isMobile = breakpoint === "mobile";
  const isTablet = breakpoint === "tablet";
  const isCompact = isMobile || isTablet;

  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [role, setRole] = useState<ProjectRole>(DEFAULT_PROJECT_ROLE);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [replaceTemplates, setReplaceTemplates] = useState(true);
  const [importError, setImportError] = useState("");
  const [importDetails, setImportDetails] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    const loadProjects = async () => {
      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/projects", { cache: "no-store" });

        if (res.status === 401) {
          router.push("/login");
          return;
        }

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Error cargando proyectos");
        }

        setProjects(Array.isArray(data) ? data : []);
      } catch (loadError) {
        console.error("Error cargando proyectos:", loadError);
        setProjects([]);
        setError("No se pudieron cargar los proyectos.");
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, [router]);

  const metrics = useMemo(() => {
    const allRequirements = projects.flatMap((project) => project.requirements || []);
    const overdue = allRequirements.filter(isRequirementOverdue).length;
    const score = allRequirements.reduce(
      (sum, requirement) => sum + getRequirementScore(requirement.status),
      0
    );

    return {
      totalProjects: projects.length,
      totalRequirements: allRequirements.length,
      overdue,
      compliance:
        allRequirements.length > 0
          ? Math.round((score / allRequirements.length) * 100)
          : 0,
    };
  }, [projects]);

  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const trimmedName = name.trim();
    const trimmedCode = code.trim();

    if (!trimmedName) {
      setError("El nombre es obligatorio.");
      return;
    }

    setCreating(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          code: trimmedCode || null,
          role,
        }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error creando proyecto");
      }

      setProjects((current) => [data as Project, ...current]);
      setName("");
      setCode("");
      setRole(DEFAULT_PROJECT_ROLE);
      setSuccess("Proyecto creado correctamente.");
    } catch (createError) {
      console.error("Error creando proyecto:", createError);
      setError(
        createError instanceof Error
          ? createError.message
          : "Error creando proyecto."
      );
    } finally {
      setCreating(false);
    }
  };

  const deleteProject = async (project: Project) => {
    const confirmed = window.confirm(
      `Seguro que quieres eliminar el proyecto "${project.name}"?`
    );

    if (!confirmed) {
      return;
    }

    setDeletingProjectId(project.id);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
        method: "DELETE",
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "No se pudo eliminar el proyecto.");
      }

      setProjects((current) => current.filter((entry) => entry.id !== project.id));
      setSuccess("Proyecto eliminado.");
    } catch (deleteError) {
      console.error("Error eliminando proyecto:", deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el proyecto."
      );
    } finally {
      setDeletingProjectId(null);
    }
  };

  const importRequirements = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setImportError("");
    setImportDetails([]);
    setImportResult(null);

    if (!importFile) {
      setImportError("Selecciona un archivo .xlsx.");
      return;
    }

    setImporting(true);

    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("replace", String(replaceTemplates));

      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setImportDetails(Array.isArray(data.details) ? data.details : []);
        throw new Error(data.error || "Error importando archivo.");
      }

      setImportResult(data.data);
      setImportFile(null);

      const input = document.getElementById(
        "requirements-import-file"
      ) as HTMLInputElement | null;

      if (input) {
        input.value = "";
      }
    } catch (loadError) {
      console.error("Error importando requisitos:", loadError);
      setImportError(
        loadError instanceof Error
          ? loadError.message
          : "Error importando archivo."
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <main style={{ ...pageStyle, ...(isMobile ? mobilePageStyle : {}) }}>
      <section
        style={{
          ...heroStyle,
          ...(isMobile ? mobileHeroStyle : {}),
        }}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <span style={eyebrowStyle}>Workspace de proyectos</span>
          <h1 style={{ ...heroTitleStyle, ...(isMobile ? mobileHeroTitleStyle : {}) }}>
            Gestion de proyectos
          </h1>
          <p style={heroDescriptionStyle}>
            Crea proyectos, define su funcion ISO 19650 y administra las
            plantillas base que se cargan automaticamente.
          </p>
        </div>

        <div style={{ ...heroActionsStyle, ...(isMobile ? mobileHeroActionsStyle : {}) }}>
          <Link href="/dashboard" style={secondaryActionStyle}>
            Ir al dashboard
          </Link>
        </div>
      </section>

      <section
        style={{
          ...kpiGridStyle,
          gridTemplateColumns: isMobile
            ? "repeat(2, minmax(0, 1fr))"
            : kpiGridStyle.gridTemplateColumns,
        }}
      >
        <KpiCard
          label="Proyectos"
          value={loading ? "..." : metrics.totalProjects}
          tone="neutral"
        />
        <KpiCard
          label="Requerimientos"
          value={loading ? "..." : metrics.totalRequirements}
          tone="neutral"
        />
        <KpiCard
          label="Vencidos"
          value={loading ? "..." : metrics.overdue}
          tone="risk"
        />
        <KpiCard
          label="Cumplimiento"
          value={loading ? "..." : `${metrics.compliance}%`}
          tone="success"
        />
      </section>

      {(error || success) && (
        <div style={feedbackStackStyle}>
          {error && <FeedbackBox tone="error" message={error} />}
          {success && <FeedbackBox tone="success" message={success} />}
        </div>
      )}

      <section
        style={{
          ...topPanelsGridStyle,
          gridTemplateColumns: isMobile
            ? "minmax(0, 1fr)"
            : topPanelsGridStyle.gridTemplateColumns,
        }}
      >
        <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
          <section style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h2 style={panelTitleStyle}>Crear proyecto</h2>
                <p style={panelDescriptionStyle}>
                  Elige la funcion del proyecto para cargar automaticamente los
                  requerimientos aplicables.
                </p>
              </div>
            </div>

            <form
              onSubmit={createProject}
              style={{
                ...formGridStyle,
                gridTemplateColumns: isMobile
                  ? "minmax(0, 1fr)"
                  : formGridStyle.gridTemplateColumns,
              }}
            >
              <label style={fieldStyle}>
                <span>Nombre</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ej. Hospital Norte"
                  required
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span>Codigo</span>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="Ej. HN-001"
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span>Funcion del proyecto</span>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value as ProjectRole)}
                  required
                  style={inputStyle}
                >
                  {PROJECT_ROLE_VALUES.map((projectRole) => (
                    <option key={projectRole} value={projectRole}>
                      {getProjectRoleLabel(projectRole)}
                    </option>
                  ))}
                </select>
              </label>

              <div style={formActionRowStyle}>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    ...primaryButtonStyle,
                    cursor: creating ? "not-allowed" : "pointer",
                    opacity: creating ? 0.72 : 1,
                  }}
                >
                  {creating ? "Creando..." : "Crear proyecto"}
                </button>
              </div>
            </form>
          </section>

          <section style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h2 style={panelTitleStyle}>Plantilla global de requisitos</h2>
                <p style={panelDescriptionStyle}>
                  Importa una plantilla base desde Excel para reutilizarla al dar
                  de alta nuevos proyectos.
                </p>
              </div>
            </div>

            <form
              onSubmit={importRequirements}
              style={{
                ...formGridStyle,
                gridTemplateColumns: isMobile
                  ? "minmax(0, 1fr)"
                  : formGridStyle.gridTemplateColumns,
              }}
            >
              <label style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
                <span>Archivo .xlsx</span>
                <input
                  id="requirements-import-file"
                  type="file"
                  accept=".xlsx"
                  onChange={(event) => setImportFile(event.target.files?.[0] || null)}
                  style={fileInputStyle}
                />
              </label>

              <label style={checkboxFieldStyle}>
                <input
                  type="checkbox"
                  checked={replaceTemplates}
                  onChange={(event) => setReplaceTemplates(event.target.checked)}
                />
                Reemplazar plantilla actual
              </label>

              <div style={formActionRowStyle}>
                <button
                  type="submit"
                  disabled={importing}
                  style={{
                    ...primaryButtonStyle,
                    cursor: importing ? "not-allowed" : "pointer",
                    opacity: importing ? 0.72 : 1,
                  }}
                >
                  {importing ? "Importando..." : "Importar Excel"}
                </button>
              </div>
            </form>

            {importError && <FeedbackBox tone="error" message={importError} />}

            {importDetails.length > 0 && (
              <ul style={detailsStyle}>
                {importDetails.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            )}

            {importResult && (
              <FeedbackBox
                tone="success"
                message={`Importacion completada: ${importResult.imported} nuevos, ${importResult.skippedDuplicates} duplicados omitidos, ${importResult.totalRows} filas validas.`}
              />
            )}
          </section>
        </div>
      </section>

      <section style={{ margin: "18px auto 0", maxWidth: 1360 }}>
        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <h2 style={panelTitleStyle}>Listado de proyectos</h2>
              <p style={panelDescriptionStyle}>
                Accede rapido a cada proyecto o elimina los que ya no necesitas.
              </p>
            </div>
          </div>

          {loading ? (
            <div style={emptyStateStyle}>Cargando proyectos...</div>
          ) : projects.length === 0 ? (
            <div style={emptyStateStyle}>
              Aun no hay proyectos creados en este espacio de trabajo.
            </div>
          ) : (
            <div
              style={{
                ...projectListGridStyle,
                gridTemplateColumns: isCompact
                  ? "minmax(0, 1fr)"
                  : projectListGridStyle.gridTemplateColumns,
              }}
            >
              {projects.map((project) => {
                const requirements = project.requirements || [];
                const overdue = requirements.filter(isRequirementOverdue).length;
                const score = requirements.reduce(
                  (sum, requirement) => sum + getRequirementScore(requirement.status),
                  0
                );
                const compliance =
                  requirements.length > 0
                    ? Math.round((score / requirements.length) * 100)
                    : 0;

                return (
                  <article key={project.id} style={projectCardStyle}>
                    <div
                      style={{
                        ...projectCardHeaderStyle,
                        ...(isMobile ? mobileProjectCardHeaderStyle : {}),
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={projectNameRowStyle}>
                          <Link
                            href={`/projects/${encodeURIComponent(project.id)}`}
                            style={projectLinkStyle}
                          >
                            {project.name}
                          </Link>
                          <span
                            style={{
                              ...projectRoleBadgeBaseStyle,
                              ...getProjectRoleBadgeStyle(project.role),
                            }}
                          >
                            {getProjectRoleLabel(project.role)}
                          </span>
                        </div>
                        <p style={projectMetaStyle}>
                          {project.code || "Sin codigo"}
                          {project.createdAt
                            ? ` - creado ${formatDateLong(project.createdAt)}`
                            : ""}
                        </p>
                      </div>

                      <div
                        style={{
                          ...progressSummaryStyle,
                          ...(isMobile ? mobileProgressSummaryStyle : {}),
                        }}
                      >
                        <span style={progressValueStyle}>{compliance}%</span>
                        <span style={progressLabelStyle}>cumplimiento</span>
                      </div>
                    </div>

                    <div
                      style={{
                        ...metricRowStyle,
                        gridTemplateColumns: isMobile
                          ? "minmax(0, 1fr)"
                          : metricRowStyle.gridTemplateColumns,
                      }}
                    >
                      <MiniMetric
                        label="Requerimientos"
                        value={String(requirements.length)}
                      />
                      <MiniMetric
                        label="Vencidos"
                        value={String(overdue)}
                        emphasis={overdue > 0 ? "risk" : "neutral"}
                      />
                      <MiniMetric
                        label="Estado"
                        value={getHealthLabel(compliance)}
                        emphasis={getHealthTone(compliance)}
                      />
                    </div>

                    <div style={progressBarTrackStyle}>
                      <div
                        style={{
                          ...progressBarFillStyle,
                          width: `${Math.max(compliance, 6)}%`,
                          background: getComplianceColor(compliance),
                        }}
                      />
                    </div>

                    <div
                      style={{
                        ...projectActionsStyle,
                        ...(isMobile ? mobileProjectActionsStyle : {}),
                      }}
                    >
                      <Link
                        href={`/projects/${encodeURIComponent(project.id)}`}
                        style={secondaryInlineActionStyle}
                      >
                        Abrir proyecto
                      </Link>
                      <Link
                        href={`/projects/${encodeURIComponent(project.id)}/matrix`}
                        style={secondaryInlineActionStyle}
                      >
                        Ver matriz
                      </Link>
                      <button
                        type="button"
                        onClick={() => deleteProject(project)}
                        disabled={deletingProjectId === project.id}
                        style={{
                          ...dangerButtonStyle,
                          cursor:
                            deletingProjectId === project.id
                              ? "not-allowed"
                              : "pointer",
                          opacity: deletingProjectId === project.id ? 0.6 : 1,
                        }}
                      >
                        {deletingProjectId === project.id
                          ? "Eliminando..."
                          : "Eliminar"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "neutral" | "risk" | "success";
}) {
  return (
    <article style={panelStyle}>
      <span style={kpiLabelStyle}>{label}</span>
      <strong
        style={{
          ...kpiValueStyle,
          color:
            tone === "risk" ? "#b91c1c" : tone === "success" ? "#047857" : "#0f172a",
        }}
      >
        {value}
      </strong>
    </article>
  );
}

function MiniMetric({
  label,
  value,
  emphasis = "neutral",
}: {
  label: string;
  value: string;
  emphasis?: "neutral" | "risk" | "success" | "warning";
}) {
  return (
    <div style={miniMetricStyle}>
      <span style={miniMetricLabelStyle}>{label}</span>
      <strong
        style={{
          ...miniMetricValueStyle,
          color:
            emphasis === "risk"
              ? "#b91c1c"
              : emphasis === "success"
                ? "#047857"
                : emphasis === "warning"
                  ? "#b45309"
                  : "#0f172a",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function FeedbackBox({
  tone,
  message,
}: {
  tone: "error" | "success";
  message: string;
}) {
  return (
    <div
      style={{
        background: tone === "error" ? "#fef2f2" : "#ecfdf5",
        border: `1px solid ${tone === "error" ? "#fecaca" : "#bbf7d0"}`,
        borderRadius: 10,
        color: tone === "error" ? "#991b1b" : "#166534",
        marginTop: 14,
        padding: 12,
      }}
    >
      {message}
    </div>
  );
}

function useProjectsBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<"mobile" | "tablet" | "desktop">(
    "desktop"
  );

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;

      if (width < 720) {
        setBreakpoint("mobile");
        return;
      }

      if (width < 1120) {
        setBreakpoint("tablet");
        return;
      }

      setBreakpoint("desktop");
    };

    updateBreakpoint();
    window.addEventListener("resize", updateBreakpoint);

    return () => {
      window.removeEventListener("resize", updateBreakpoint);
    };
  }, []);

  return breakpoint;
}

function getRequirementScore(status?: RequirementStatus | string | null) {
  if (status === "total") return 1;
  if (status === "parcial") return 0.5;
  return 0;
}

function normalizeStatus(status?: RequirementStatus | string | null): RequirementStatus {
  if (status === "total" || status === "parcial" || status === "no_conforme") {
    return status;
  }

  return "no_conforme";
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

function formatDateLong(value?: string) {
  if (!value) return "sin fecha";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sin fecha";

  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getComplianceColor(value: number) {
  if (value >= 85) return "#16a34a";
  if (value >= 50) return "#f59e0b";
  return "#ef4444";
}

function getHealthLabel(compliance: number) {
  if (compliance >= 85) return "Estable";
  if (compliance >= 50) return "En seguimiento";
  return "Critico";
}

function getHealthTone(
  compliance: number
): "success" | "warning" | "risk" {
  if (compliance >= 85) return "success";
  if (compliance >= 50) return "warning";
  return "risk";
}

const pageStyle: React.CSSProperties = {
  background: "#f4f6fc",
  minHeight: "calc(100vh - 65px)",
  padding: "28px clamp(20px, 3vw, 36px) 40px",
};

const mobilePageStyle: React.CSSProperties = {
  padding: "20px 12px 32px",
};

const heroStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  flexWrap: "wrap",
  gap: 20,
  justifyContent: "space-between",
  margin: "0 auto 24px",
  maxWidth: 1360,
};

const mobileHeroStyle: React.CSSProperties = {
  display: "grid",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#0025df",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: "uppercase",
};

const heroTitleStyle: React.CSSProperties = {
  color: "#002a4e",
  fontSize: 34,
  lineHeight: 1.1,
  margin: 0,
};

const mobileHeroTitleStyle: React.CSSProperties = {
  fontSize: 28,
};

const heroDescriptionStyle: React.CSSProperties = {
  color: "#5b6b82",
  fontSize: 16,
  lineHeight: 1.55,
  margin: 0,
  maxWidth: 720,
};

const heroActionsStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
};

const mobileHeroActionsStyle: React.CSSProperties = {
  width: "100%",
};

const secondaryActionStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #c9d4e5",
  borderRadius: 10,
  color: "#002a4e",
  fontWeight: 700,
  padding: "12px 16px",
  textDecoration: "none",
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  margin: "0 auto 24px",
  maxWidth: 1360,
};

const topPanelsGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 18,
  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
  margin: "0 auto",
  maxWidth: 1360,
};

const feedbackStackStyle: React.CSSProperties = {
  margin: "0 auto 20px",
  maxWidth: 1360,
};

const panelStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
  minWidth: 0,
  padding: 20,
};

const panelHeaderStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  flexWrap: "wrap",
  gap: 16,
  justifyContent: "space-between",
  marginBottom: 18,
};

const panelTitleStyle: React.CSSProperties = {
  color: "#002a4e",
  fontSize: 20,
  margin: 0,
};

const panelDescriptionStyle: React.CSSProperties = {
  color: "#5b6b82",
  fontSize: 14,
  margin: "6px 0 0",
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const fieldStyle: React.CSSProperties = {
  color: "#334155",
  display: "grid",
  fontSize: 14,
  fontWeight: 700,
  gap: 8,
};

const checkboxFieldStyle: React.CSSProperties = {
  alignItems: "center",
  color: "#334155",
  display: "flex",
  fontSize: 14,
  fontWeight: 700,
  gap: 8,
  minHeight: 44,
};

const formActionRowStyle: React.CSSProperties = {
  alignItems: "end",
  display: "flex",
};

const inputStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  minHeight: 44,
  padding: "10px 12px",
};

const fileInputStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  minHeight: 44,
  padding: 8,
};

const primaryButtonStyle: React.CSSProperties = {
  background: "#0025df",
  border: "1px solid #0025df",
  borderRadius: 10,
  color: "#ffffff",
  fontWeight: 700,
  minHeight: 44,
  padding: "10px 16px",
};

const detailsStyle: React.CSSProperties = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  borderRadius: 10,
  color: "#9a3412",
  margin: "14px 0 0",
  padding: "10px 10px 10px 28px",
};

const kpiLabelStyle: React.CSSProperties = {
  color: "#64748b",
  display: "block",
  fontSize: 13,
  fontWeight: 700,
};

const kpiValueStyle: React.CSSProperties = {
  display: "block",
  fontSize: 34,
  lineHeight: 1.1,
  marginTop: 10,
};

const emptyStateStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  borderRadius: 12,
  color: "#64748b",
  padding: 22,
  textAlign: "center",
};

const projectCardStyle: React.CSSProperties = {
  border: "1px solid #e7edf5",
  borderRadius: 12,
  display: "grid",
  gap: 14,
  padding: 16,
};

const projectListGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  margin: "0 auto",
  maxWidth: 1040,
  width: "100%",
};

const projectCardHeaderStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 18,
  justifyContent: "space-between",
};

const mobileProjectCardHeaderStyle: React.CSSProperties = {
  display: "grid",
};

const projectNameRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};

const projectLinkStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 22,
  fontWeight: 800,
  lineHeight: 1.2,
  textDecoration: "none",
};

const projectMetaStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  margin: "6px 0 0",
};

const projectRoleBadgeBaseStyle: React.CSSProperties = {
  borderRadius: 999,
  display: "inline-flex",
  fontSize: 12,
  fontWeight: 800,
  padding: "6px 10px",
};

const progressSummaryStyle: React.CSSProperties = {
  alignItems: "flex-end",
  display: "grid",
  justifyItems: "end",
  minWidth: 90,
};

const mobileProgressSummaryStyle: React.CSSProperties = {
  justifyItems: "start",
  minWidth: 0,
};

const progressValueStyle: React.CSSProperties = {
  color: "#002a4e",
  fontSize: 26,
  fontWeight: 800,
  lineHeight: 1,
};

const progressLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  marginTop: 4,
};

const metricRowStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
};

const miniMetricStyle: React.CSSProperties = {
  background: "#f8fafc",
  borderRadius: 10,
  display: "grid",
  gap: 6,
  padding: "10px 12px",
};

const miniMetricLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 700,
};

const miniMetricValueStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
};

const progressBarTrackStyle: React.CSSProperties = {
  background: "#e5edf6",
  borderRadius: 999,
  height: 8,
  overflow: "hidden",
};

const progressBarFillStyle: React.CSSProperties = {
  borderRadius: 999,
  height: "100%",
};

const projectActionsStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};

const mobileProjectActionsStyle: React.CSSProperties = {
  display: "grid",
};

const secondaryInlineActionStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #d9e3f0",
  borderRadius: 10,
  color: "#002a4e",
  fontSize: 13,
  fontWeight: 700,
  padding: "8px 12px",
  textDecoration: "none",
};

const dangerButtonStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #fecaca",
  borderRadius: 10,
  color: "#b91c1c",
  fontSize: 13,
  fontWeight: 700,
  padding: "8px 12px",
  whiteSpace: "nowrap",
};
