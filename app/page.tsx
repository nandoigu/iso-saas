"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getProjectRoleBadgeStyle,
  getProjectRoleLabel,
} from "@/app/lib/projectRoles";
import { Notice } from "@/components/Notice";
import {
  appEmptyStateStyle,
  appPanelStyle,
  appSecondaryButtonStyle,
} from "@/components/uiStyles";

type RequirementStatus = "total" | "parcial" | "no_conforme";

type Requirement = {
  id: string;
  norma?: string | null;
  item?: string | null;
  name: string;
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

type AuthUser = {
  name?: string | null;
  email: string;
};

export default function Home() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadHome() {
      setLoading(true);
      setError("");

      try {
        const [projectsResponse, authResponse] = await Promise.all([
          fetch("/api/projects", { cache: "no-store" }),
          fetch("/api/auth/me", { cache: "no-store" }),
        ]);

        if (projectsResponse.status === 401 || projectsResponse.status === 403) {
          await fetch("/api/auth/logout", { method: "POST" });
          router.replace("/login?next=/");
          return;
        }

        if (!projectsResponse.ok) {
          throw new Error("No se pudo cargar la información de proyectos.");
        }

        const projectsData = await projectsResponse.json();
        const authData = authResponse.ok ? await authResponse.json() : null;

        if (cancelled) return;

        setProjects(Array.isArray(projectsData) ? projectsData : []);
        setUser(authData?.data?.user ?? null);
      } catch (loadError) {
        console.error("Error cargando la home:", loadError);
        if (cancelled) return;
        setProjects([]);
        setUser(null);
        setError("No se pudieron cargar los datos de inicio.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadHome();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const allRequirements = useMemo(
    () =>
      projects.flatMap((project) =>
        (project.requirements || []).map((requirement) => ({
          ...requirement,
          projectId: project.id,
          projectName: project.name,
        }))
      ),
    [projects]
  );

  const metrics = useMemo(() => {
    const totalRequirements = allRequirements.length;
    const overdue = allRequirements.filter(isRequirementOverdue).length;
    const score = allRequirements.reduce(
      (sum, requirement) => sum + getRequirementScore(requirement.status),
      0
    );

    return {
      totalProjects: projects.length,
      totalRequirements,
      overdue,
      compliance:
        totalRequirements > 0 ? Math.round((score / totalRequirements) * 100) : 0,
    };
  }, [allRequirements, projects.length]);

  const upcomingRequirements = useMemo(
    () =>
      allRequirements
        .filter(isRequirementUpcoming)
        .sort((left, right) => compareDeadline(left.deadline, right.deadline))
        .slice(0, 4),
    [allRequirements]
  );

  const overdueRequirements = useMemo(
    () =>
      allRequirements
        .filter(isRequirementOverdue)
        .sort((left, right) => compareDeadline(left.deadline, right.deadline))
        .slice(0, 4),
    [allRequirements]
  );

  const recentProjects = useMemo(
    () =>
      [...projects]
        .sort((left, right) => {
          const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
          const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
          return rightTime - leftTime;
        })
        .slice(0, 6),
    [projects]
  );

  const projectCards = useMemo(
    () =>
      recentProjects.map((project) => {
        const requirements = project.requirements || [];
        const overdue = requirements.filter(isRequirementOverdue).length;
        const score = requirements.reduce(
          (sum, requirement) => sum + getRequirementScore(requirement.status),
          0
        );
        const compliance =
          requirements.length > 0 ? Math.round((score / requirements.length) * 100) : 0;

        return {
          ...project,
          requirementCount: requirements.length,
          overdue,
          compliance,
        };
      }),
    [recentProjects]
  );

  const userLabel = user?.name?.trim() || user?.email || "Equipo";

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div style={{ display: "grid", gap: 10 }}>
          <span style={eyebrowStyle}>Workspace ISO 19650</span>
          <h1 style={heroTitleStyle}>Panel de cumplimiento</h1>
          <p style={heroDescriptionStyle}>
            {userLabel}, aquí tienes un resumen operativo de proyectos,
            requerimientos y vencimientos para entrar rápido a lo importante.
          </p>
        </div>

        <div style={heroActionsStyle}>
          <Link href="/projects" style={primaryActionStyle}>
            Nuevo proyecto
          </Link>
          <Link href="/dashboard" style={secondaryActionStyle}>
            Ir al dashboard
          </Link>
        </div>
      </section>

      {error && (
        <Notice
          tone="error"
          message={error}
          style={{ margin: "0 auto 20px", maxWidth: 1360 }}
        />
      )}

      <section style={kpiGridStyle}>
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
          label="Cumplimiento global"
          value={loading ? "..." : `${metrics.compliance}%`}
          tone="success"
        />
      </section>

      <section style={contentGridStyle}>
        <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
          <section style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h2 style={panelTitleStyle}>Proyectos</h2>
                <p style={panelDescriptionStyle}>
                  {loading
                    ? "Cargando proyectos..."
                    : `${projects.length} proyectos disponibles`}
                </p>
              </div>
              <Link href="/projects" style={textActionStyle}>
                Gestionar proyectos
              </Link>
            </div>

            {loading ? (
              <div style={emptyStateStyle}>Preparando resumen de proyectos...</div>
            ) : projectCards.length === 0 ? (
              <div style={emptyStateStyle}>
                Crea tu primer proyecto para empezar a trabajar con la matriz y el
                dashboard.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {projectCards.map((project) => (
                  <article key={project.id} style={projectCardStyle}>
                    <div style={projectCardHeaderStyle}>
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
                          {project.code || "Sin código"}{" "}
                          {project.createdAt
                            ? `- creado ${formatDateLong(project.createdAt)}`
                            : ""}
                        </p>
                      </div>

                      <div style={progressSummaryStyle}>
                        <span style={progressValueStyle}>{project.compliance}%</span>
                        <span style={progressLabelStyle}>cumplimiento</span>
                      </div>
                    </div>

                    <div style={metricRowStyle}>
                      <MiniMetric
                        label="Requerimientos"
                        value={String(project.requirementCount)}
                      />
                      <MiniMetric
                        label="Vencidos"
                        value={String(project.overdue)}
                        emphasis={project.overdue > 0 ? "risk" : "neutral"}
                      />
                      <MiniMetric
                        label="Estado"
                        value={getHealthLabel(project.compliance)}
                        emphasis={getHealthTone(project.compliance)}
                      />
                    </div>

                    <div style={progressBarTrackStyle}>
                      <div
                        style={{
                          ...progressBarFillStyle,
                          width: `${Math.max(project.compliance, 6)}%`,
                          background: getComplianceColor(project.compliance),
                        }}
                      />
                    </div>

                    <div style={projectActionsStyle}>
                      <Link
                        href={`/projects/${encodeURIComponent(project.id)}`}
                        style={secondaryInlineActionStyle}
                      >
                        Abrir
                      </Link>
                      <Link
                        href={`/projects/${encodeURIComponent(project.id)}/matrix`}
                        style={secondaryInlineActionStyle}
                      >
                        Matriz
                      </Link>
                      <Link href="/dashboard" style={secondaryInlineActionStyle}>
                        Dashboard
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside style={{ display: "grid", gap: 18, minWidth: 0 }}>
          <section style={panelStyle}>
            <div style={panelHeaderCompactStyle}>
              <div>
                <h2 style={panelTitleStyle}>Alertas</h2>
                <p style={panelDescriptionStyle}>
                  Requerimientos que requieren atención inmediata.
                </p>
              </div>
              <Link href="/dashboard" style={textActionStyle}>
                Ver dashboard
              </Link>
            </div>

            <div style={alertCounterGridStyle}>
              <CounterCard
                label="Vencidos"
                value={loading ? "..." : overdueRequirements.length}
                tone="risk"
              />
              <CounterCard
                label="Próximos"
                value={loading ? "..." : upcomingRequirements.length}
                tone="warning"
              />
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {loading ? (
                <div style={emptyStateCompactStyle}>Buscando alertas...</div>
              ) : overdueRequirements.length === 0 && upcomingRequirements.length === 0 ? (
                <div style={emptyStateCompactStyle}>
                  No hay vencimientos ni próximos plazos ahora mismo.
                </div>
              ) : (
                [...overdueRequirements, ...upcomingRequirements]
                  .slice(0, 5)
                  .map((requirement) => (
                    <div
                      key={requirement.id}
                      style={{
                        ...alertItemStyle,
                        borderLeftColor: isRequirementOverdue(requirement)
                          ? "#dc2626"
                          : "#d97706",
                      }}
                    >
                      <strong style={{ fontSize: 14 }}>
                        {requirement.projectName}
                      </strong>
                      <span style={alertMetaStyle}>
                        {getDisplayValue(requirement.norma, "Sin norma")} /{" "}
                        {getDisplayValue(requirement.item, "Sin item")} -{" "}
                        {formatDate(requirement.deadline)}
                      </span>
                      <span style={alertTextStyle}>{requirement.name}</span>
                    </div>
                  ))
              )}
            </div>
          </section>

          <section style={panelStyle}>
            <h2 style={panelTitleStyle}>Actividad reciente</h2>
            <p style={panelDescriptionStyle}>
              Últimos proyectos creados en tu espacio de trabajo.
            </p>

            <div style={{ display: "grid", gap: 10 }}>
              {loading ? (
                <div style={emptyStateCompactStyle}>Cargando actividad...</div>
              ) : recentProjects.length === 0 ? (
                <div style={emptyStateCompactStyle}>Todavía no hay actividad reciente.</div>
              ) : (
                recentProjects.slice(0, 4).map((project) => (
                  <div key={project.id} style={activityItemStyle}>
                    <div>
                      <strong style={{ display: "block", fontSize: 14 }}>
                        {project.name}
                      </strong>
                      <span style={activityMetaStyle}>
                        {getProjectRoleLabel(project.role)}
                      </span>
                    </div>
                    <span style={activityDateStyle}>
                      {formatDateLong(project.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section style={panelStyle}>
            <h2 style={panelTitleStyle}>Accesos rápidos</h2>
            <p style={panelDescriptionStyle}>
              Atajos para las acciones más frecuentes de la plataforma.
            </p>

            <div style={quickActionsGridStyle}>
              <Link href="/projects" style={quickActionTileStyle}>
                <span style={quickActionTitleStyle}>Crear o gestionar proyectos</span>
                <span style={quickActionDescriptionStyle}>
                  Alta de proyectos, importación y seguimiento.
                </span>
              </Link>
              <Link href="/dashboard" style={quickActionTileStyle}>
                <span style={quickActionTitleStyle}>Abrir dashboard BI</span>
                <span style={quickActionDescriptionStyle}>
                  Análisis de cumplimiento y vencimientos.
                </span>
              </Link>
              <Link href="/matrix" style={quickActionTileStyle}>
                <span style={quickActionTitleStyle}>Revisar matrices</span>
                <span style={quickActionDescriptionStyle}>
                  Consulta rápida de cumplimiento por proyecto.
                </span>
              </Link>
              <Link href="/profile" style={quickActionTileStyle}>
                <span style={quickActionTitleStyle}>Perfil y seguridad</span>
                <span style={quickActionDescriptionStyle}>
                  Datos de usuario, contraseña y preferencias.
                </span>
              </Link>
            </div>
          </section>
        </aside>
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

function CounterCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "risk" | "warning";
}) {
  return (
    <div
      style={{
        ...counterCardStyle,
        background: tone === "risk" ? "#fef2f2" : "#fff7ed",
        borderColor: tone === "risk" ? "#fecaca" : "#fed7aa",
      }}
    >
      <span style={counterLabelStyle}>{label}</span>
      <strong
        style={{
          ...counterValueStyle,
          color: tone === "risk" ? "#b91c1c" : "#c2410c",
        }}
      >
        {value}
      </strong>
    </div>
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

function compareDeadline(left?: string | null, right?: string | null) {
  const leftTime = left ? new Date(left).getTime() : Number.POSITIVE_INFINITY;
  const rightTime = right ? new Date(right).getTime() : Number.POSITIVE_INFINITY;
  return leftTime - rightTime;
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
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

function getDisplayValue(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function getComplianceColor(value: number) {
  if (value >= 85) return "#16a34a";
  if (value >= 50) return "#f59e0b";
  return "#ef4444";
}

function getHealthLabel(compliance: number) {
  if (compliance >= 85) return "Estable";
  if (compliance >= 50) return "En seguimiento";
  return "Crítico";
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

const heroStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  flexWrap: "wrap",
  gap: 16,
  justifyContent: "space-between",
  margin: "0 auto 20px",
  maxWidth: 1360,
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
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
};

const primaryActionStyle: React.CSSProperties = {
  background: "#0025df",
  borderRadius: 8,
  color: "#ffffff",
  fontWeight: 650,
  padding: "10px 14px",
  textDecoration: "none",
};

const secondaryActionStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #c9d4e5",
  borderRadius: 8,
  color: "#002a4e",
  fontWeight: 600,
  padding: "10px 14px",
  textDecoration: "none",
};

const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  margin: "0 auto 24px",
  maxWidth: 1360,
};

const contentGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 18,
  gridTemplateColumns: "minmax(0, 1.6fr) minmax(320px, 0.9fr)",
  margin: "0 auto",
  maxWidth: 1360,
};

const panelStyle: React.CSSProperties = {
  ...appPanelStyle,
  padding: 18,
};

const panelHeaderStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  flexWrap: "wrap",
  gap: 16,
  justifyContent: "space-between",
  marginBottom: 18,
};

const panelHeaderCompactStyle: React.CSSProperties = {
  ...panelHeaderStyle,
  marginBottom: 16,
};

const panelTitleStyle: React.CSSProperties = {
  color: "#002a4e",
  fontSize: 18,
  fontWeight: 500,
  margin: 0,
};

const panelDescriptionStyle: React.CSSProperties = {
  color: "#5b6b82",
  fontSize: 14,
  margin: "6px 0 0",
};

const textActionStyle: React.CSSProperties = {
  color: "#0025df",
  fontSize: 14,
  fontWeight: 600,
  textDecoration: "none",
};

const kpiLabelStyle: React.CSSProperties = {
  color: "#64748b",
  display: "block",
  fontSize: 13,
  fontWeight: 600,
};

const kpiValueStyle: React.CSSProperties = {
  display: "block",
  fontSize: 28,
  fontWeight: 600,
  lineHeight: 1.1,
  marginTop: 8,
};

const projectCardStyle: React.CSSProperties = {
  border: "1px solid #e7edf5",
  borderRadius: 8,
  display: "grid",
  gap: 12,
  padding: 14,
};

const projectCardHeaderStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 18,
  justifyContent: "space-between",
};

const projectNameRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};

const projectLinkStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 500,
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
  fontWeight: 600,
  padding: "5px 9px",
};

const progressSummaryStyle: React.CSSProperties = {
  alignItems: "flex-end",
  display: "grid",
  justifyItems: "end",
  minWidth: 90,
};

const progressValueStyle: React.CSSProperties = {
  color: "#002a4e",
  fontSize: 22,
  fontWeight: 600,
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
  borderRadius: 8,
  display: "grid",
  gap: 6,
  padding: "10px 12px",
};

const miniMetricLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 600,
};

const miniMetricValueStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
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

const secondaryInlineActionStyle: React.CSSProperties = {
  ...appSecondaryButtonStyle,
  color: "#002a4e",
  fontSize: 13,
  minHeight: 0,
  padding: "8px 12px",
  textDecoration: "none",
};

const alertCounterGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  marginBottom: 16,
};

const counterCardStyle: React.CSSProperties = {
  border: "1px solid",
  borderRadius: 8,
  display: "grid",
  gap: 6,
  padding: 12,
};

const counterLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 600,
};

const counterValueStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 600,
};

const alertItemStyle: React.CSSProperties = {
  background: "#fcfdff",
  border: "1px solid #e7edf5",
  borderLeft: "3px solid",
  borderRadius: 8,
  display: "grid",
  gap: 4,
  padding: "12px 12px 12px 14px",
};

const alertMetaStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
};

const alertTextStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 13,
  lineHeight: 1.45,
};

const activityItemStyle: React.CSSProperties = {
  alignItems: "center",
  borderBottom: "1px solid #edf2f7",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
  paddingBottom: 10,
};

const activityMetaStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
};

const activityDateStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  whiteSpace: "nowrap",
};

const quickActionsGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const quickActionTileStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #dde6f2",
  borderRadius: 8,
  color: "inherit",
  display: "grid",
  gap: 6,
  padding: 12,
  textDecoration: "none",
};

const quickActionTitleStyle: React.CSSProperties = {
  color: "#002a4e",
  fontSize: 14,
  fontWeight: 600,
};

const quickActionDescriptionStyle: React.CSSProperties = {
  color: "#5b6b82",
  fontSize: 13,
  lineHeight: 1.45,
};

const emptyStateStyle: React.CSSProperties = {
  ...appEmptyStateStyle,
};

const emptyStateCompactStyle: React.CSSProperties = {
  ...emptyStateStyle,
  fontSize: 14,
  padding: 16,
};
