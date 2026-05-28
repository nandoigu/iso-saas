"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PROJECT_ROLE,
  getProjectRoleBadgeStyle,
  getProjectRoleLabel,
  isProjectRole,
  PROJECT_ROLE_VALUES,
  type ProjectRole,
} from "@/app/lib/projectRoles";
import {
  DestructiveConfirmationDialog,
  type DestructiveConfirmationState,
} from "@/components/DestructiveConfirmationDialog";
import { EmptyState } from "@/components/EmptyState";
import { Notice } from "@/components/Notice";
import {
  appBadgeBaseStyle,
  appDangerButtonStyle,
  appFieldStyle,
  appHelpPanelStyle,
  appPanelStyle,
  appPrimaryButtonStyle,
  appSecondaryButtonStyle,
  getActionStateStyle,
} from "@/components/uiStyles";

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
  replaced?: boolean;
};

type ProjectSortMode = "recent" | "name" | "compliance" | "overdue";
type ProjectRiskFilter = "all" | "overdue" | "low_compliance" | "empty";

const PROJECT_LIST_FILTERS_STORAGE_KEY = "bmo:project-list-filters";
const naturalCollator = new Intl.Collator("es", {
  numeric: true,
  sensitivity: "base",
});

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
  const [confirmation, setConfirmation] =
    useState<DestructiveConfirmationState | null>(null);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [replaceTemplates, setReplaceTemplates] = useState(true);
  const [importError, setImportError] = useState("");
  const [importDetails, setImportDetails] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [listSearchTerm, setListSearchTerm] = useState("");
  const [listRoleFilter, setListRoleFilter] = useState<ProjectRole | "all">("all");
  const [listRiskFilter, setListRiskFilter] = useState<ProjectRiskFilter>("all");
  const [listSortMode, setListSortMode] = useState<ProjectSortMode>("recent");
  const [listFiltersHydrated, setListFiltersHydrated] = useState(false);

  useEffect(() => {
    const loadProjects = async () => {
      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/projects", { cache: "no-store" });

        if (res.status === 401 || res.status === 403) {
          await fetch("/api/auth/logout", { method: "POST" });
          router.replace("/login?next=/projects");
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

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PROJECT_LIST_FILTERS_STORAGE_KEY);
      const saved = raw ? JSON.parse(raw) : null;

      if (typeof saved?.searchTerm === "string") {
        setListSearchTerm(saved.searchTerm);
      }
      if (saved?.roleFilter === "all" || isProjectRoleFilter(saved?.roleFilter)) {
        setListRoleFilter(saved.roleFilter);
      }
      if (isProjectRiskFilter(saved?.riskFilter)) {
        setListRiskFilter(saved.riskFilter);
      }
      if (isProjectSortMode(saved?.sortMode)) {
        setListSortMode(saved.sortMode);
      }
    } catch (error) {
      console.error("Error recuperando filtros de proyectos:", error);
    } finally {
      setListFiltersHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!listFiltersHydrated) return;

    window.localStorage.setItem(
      PROJECT_LIST_FILTERS_STORAGE_KEY,
      JSON.stringify({
        searchTerm: listSearchTerm,
        roleFilter: listRoleFilter,
        riskFilter: listRiskFilter,
        sortMode: listSortMode,
      })
    );
  }, [
    listFiltersHydrated,
    listRiskFilter,
    listRoleFilter,
    listSearchTerm,
    listSortMode,
  ]);

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

  const projectCards = useMemo(() => {
    const normalizedSearch = listSearchTerm.trim().toLowerCase();

    return projects
      .map((project) => {
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

        return {
          ...project,
          compliance,
          overdue,
          requirementCount: requirements.length,
        };
      })
      .filter((project) => {
        if (listRoleFilter !== "all" && project.role !== listRoleFilter) {
          return false;
        }

        if (listRiskFilter === "overdue" && project.overdue === 0) return false;
        if (listRiskFilter === "low_compliance" && project.compliance >= 50) {
          return false;
        }
        if (listRiskFilter === "empty" && project.requirementCount > 0) return false;

        if (!normalizedSearch) return true;

        const haystack = [
          project.name,
          project.code,
          getProjectRoleLabel(project.role),
          String(project.requirementCount),
        ]
          .map((value) => String(value ?? "").toLowerCase())
          .join(" ");

        return haystack.includes(normalizedSearch);
      })
      .sort((left, right) => {
        if (listSortMode === "name") {
          return naturalCompare(left.name, right.name);
        }

        if (listSortMode === "compliance") {
          return right.compliance - left.compliance || naturalCompare(left.name, right.name);
        }

        if (listSortMode === "overdue") {
          return right.overdue - left.overdue || naturalCompare(left.name, right.name);
        }

        const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
        const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
        return rightTime - leftTime || naturalCompare(left.name, right.name);
      });
  }, [listRiskFilter, listRoleFilter, listSearchTerm, listSortMode, projects]);

  const activeProjectFilterCount =
    (listSearchTerm.trim() ? 1 : 0) +
    (listRoleFilter !== "all" ? 1 : 0) +
    (listRiskFilter !== "all" ? 1 : 0) +
    (listSortMode !== "recent" ? 1 : 0);

  const resetProjectListFilters = () => {
    setListSearchTerm("");
    setListRoleFilter("all");
    setListRiskFilter("all");
    setListSortMode("recent");
  };

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

  const deleteProject = (project: Project) => {
    setConfirmation({
      title: "Eliminar proyecto",
      message: `¿Seguro que quieres eliminar el proyecto "${project.name}"?\n\nEsta acción eliminará también sus requerimientos y no se puede deshacer.`,
      confirmLabel: "Eliminar proyecto",
      onConfirm: () => void confirmDeleteProject(project),
    });
  };

  const confirmDeleteProject = async (project: Project) => {
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

  const clearImportFeedback = () => {
    setImportError("");
    setImportDetails([]);
    setImportResult(null);
  };

  const handleImportFileChange = (file: File | null) => {
    setImportFile(file);
    clearImportFeedback();
  };

  const handleReplaceTemplatesChange = (checked: boolean) => {
    setReplaceTemplates(checked);
    clearImportFeedback();
  };

  const importRequirements = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearImportFeedback();

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
      <DestructiveConfirmationDialog
        confirmation={confirmation}
        onCancel={() => setConfirmation(null)}
      />

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
            Crea proyectos, define su función ISO 19650 y administra las
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
          {error && <Notice tone="error" message={error} compact />}
          {success && <Notice tone="success" message={success} compact />}
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
          <section id="create-project" style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h2 style={panelTitleStyle}>Crear proyecto</h2>
                <p style={panelDescriptionStyle}>
                  Elige la función del proyecto para cargar automáticamente los
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
                  aria-disabled={creating}
                  style={{
                    ...primaryButtonStyle,
                    ...getActionStateStyle(creating),
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
                  onChange={(event) =>
                    handleImportFileChange(event.target.files?.[0] || null)
                  }
                  style={fileInputStyle}
                />
              </label>

              <label style={checkboxFieldStyle}>
                <input
                  type="checkbox"
                  checked={replaceTemplates}
                  onChange={(event) =>
                    handleReplaceTemplatesChange(event.target.checked)
                  }
                />
                Reemplazar plantilla actual
              </label>

              <div style={formActionRowStyle}>
                <button
                  type="submit"
                  disabled={importing}
                  aria-disabled={importing}
                  style={{
                    ...primaryButtonStyle,
                    ...getActionStateStyle(importing),
                  }}
                >
                  {importing ? "Importando..." : "Importar Excel"}
                </button>
              </div>
            </form>

            <div style={importHelpStyle}>
              <strong>Formato aceptado para plantilla global</strong>
              <p>
                Usa una hoja Excel con cabecera en la primera fila y las columnas
                <code> norma </code>, <code> item </code>, <code> titulo </code> y
                <code> descripcion </code>. La columna <code> fase </code> es opcional.
              </p>
              <p>
                Si marcas reemplazar, la plantilla actual se vacía antes de cargar las
                filas válidas del archivo.
              </p>
            </div>

            {importing && (
              <Notice
                tone="info"
                message="Importando plantilla global. Mantén esta página abierta hasta que termine."
                compact
                style={{ marginTop: 14 }}
              />
            )}

            {importError && (
              <Notice
                tone="error"
                message={importError}
                compact
                style={{ marginTop: 14 }}
              />
            )}

            {importDetails.length > 0 && (
              <ul style={detailsStyle}>
                {importDetails.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            )}

            {importResult && (
              <Notice
                tone="success"
                message={`${
                  importResult.replaced
                    ? "Plantilla reemplazada"
                    : "Importación completada"
                }: ${importResult.imported} nuevos, ${
                  importResult.skippedDuplicates
                } duplicados omitidos, ${importResult.totalRows} filas válidas.`}
                compact
                style={{ marginTop: 14 }}
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
                Accede rápido a cada proyecto, ordena la cartera y vuelve sin perder
                tus filtros.
              </p>
            </div>
            <button
              type="button"
              onClick={resetProjectListFilters}
              disabled={activeProjectFilterCount === 0}
              aria-disabled={activeProjectFilterCount === 0}
              style={{
                ...secondaryInlineActionStyle,
                ...getActionStateStyle(activeProjectFilterCount === 0),
              }}
            >
              Limpiar filtros
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: isCompact
                ? "minmax(0, 1fr)"
                : "minmax(260px, 1.2fr) repeat(3, minmax(170px, 0.8fr))",
              marginBottom: 18,
            }}
          >
            <label style={fieldStyle}>
              Buscar
              <input
                value={listSearchTerm}
                onChange={(event) => setListSearchTerm(event.target.value)}
                placeholder="Nombre, código, rol o métricas"
                style={inputStyle}
              />
            </label>

            <label style={fieldStyle}>
              Rol
              <select
                value={listRoleFilter}
                onChange={(event) =>
                  setListRoleFilter(event.target.value as ProjectRole | "all")
                }
                style={inputStyle}
              >
                <option value="all">Todos</option>
                {PROJECT_ROLE_VALUES.map((projectRole) => (
                  <option key={projectRole} value={projectRole}>
                    {getProjectRoleLabel(projectRole)}
                  </option>
                ))}
              </select>
            </label>

            <label style={fieldStyle}>
              Riesgo
              <select
                value={listRiskFilter}
                onChange={(event) =>
                  setListRiskFilter(event.target.value as ProjectRiskFilter)
                }
                style={inputStyle}
              >
                <option value="all">Todos</option>
                <option value="overdue">Con vencidos</option>
                <option value="low_compliance">Cumplimiento bajo</option>
                <option value="empty">Sin requerimientos</option>
              </select>
            </label>

            <label style={fieldStyle}>
              Ordenar
              <select
                value={listSortMode}
                onChange={(event) =>
                  setListSortMode(event.target.value as ProjectSortMode)
                }
                style={inputStyle}
              >
                <option value="recent">Más recientes</option>
                <option value="name">Nombre</option>
                <option value="compliance">Cumplimiento</option>
                <option value="overdue">Vencidos</option>
              </select>
            </label>
          </div>

          <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 14px" }}>
            {projectCards.length} de {projects.length} proyectos visibles
            {activeProjectFilterCount > 0
              ? ` · ${activeProjectFilterCount} filtros activos`
              : ""}{" "}
            · filtros recordados
          </p>

          {loading ? (
            <EmptyState
              title="Cargando proyectos"
              description="Preparando la cartera y sus métricas."
            />
          ) : projects.length === 0 ? (
            <EmptyState
              title="Sin proyectos"
              description="Crea el primer proyecto para generar requisitos, abrir la matriz y empezar a medir cumplimiento."
              action={
                <a href="#create-project" style={secondaryInlineActionStyle}>
                  Ir a crear proyecto
                </a>
              }
            />
          ) : projectCards.length === 0 ? (
            <EmptyState
              title="Sin resultados"
              description="No hay proyectos que coincidan con los filtros actuales."
            />
          ) : (
            <div
              style={{
                ...projectListGridStyle,
                gridTemplateColumns: isCompact
                  ? "minmax(0, 1fr)"
                  : projectListGridStyle.gridTemplateColumns,
              }}
            >
              {projectCards.map((project) => {
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
                          {project.code || "Sin código"}
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
                        <span style={progressValueStyle}>{project.compliance}%</span>
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
                      <Link
                        href={`/dashboard?projectId=${encodeURIComponent(project.id)}`}
                        style={secondaryInlineActionStyle}
                      >
                        Ver dashboard
                      </Link>
                      <button
                        type="button"
                        onClick={() => deleteProject(project)}
                        disabled={deletingProjectId === project.id}
                        aria-disabled={deletingProjectId === project.id}
                        style={{
                          ...dangerButtonStyle,
                          ...getActionStateStyle(
                            deletingProjectId === project.id
                          ),
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

function naturalCompare(left: string, right: string) {
  return naturalCollator.compare(left, right);
}

function isProjectRoleFilter(value: unknown): value is ProjectRole {
  return isProjectRole(value);
}

function isProjectRiskFilter(value: unknown): value is ProjectRiskFilter {
  return (
    value === "all" ||
    value === "overdue" ||
    value === "low_compliance" ||
    value === "empty"
  );
}

function isProjectSortMode(value: unknown): value is ProjectSortMode {
  return (
    value === "recent" ||
    value === "name" ||
    value === "compliance" ||
    value === "overdue"
  );
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
  gap: 16,
  justifyContent: "space-between",
  margin: "0 auto 20px",
  maxWidth: 1360,
};

const mobileHeroStyle: React.CSSProperties = {
  display: "grid",
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

const mobileHeroTitleStyle: React.CSSProperties = {
  fontSize: 24,
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

const mobileHeroActionsStyle: React.CSSProperties = {
  width: "100%",
};

const secondaryActionStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #c9d4e5",
  borderRadius: 8,
  color: "#002a4e",
  fontWeight: 500,
  padding: "8px 13px",
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

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const fieldStyle: React.CSSProperties = {
  color: "#334155",
  display: "grid",
  fontSize: 14,
  fontWeight: 600,
  gap: 8,
};

const checkboxFieldStyle: React.CSSProperties = {
  alignItems: "center",
  color: "#334155",
  display: "flex",
  fontSize: 14,
  fontWeight: 600,
  gap: 8,
  minHeight: 40,
};

const formActionRowStyle: React.CSSProperties = {
  alignItems: "end",
  display: "flex",
};

const inputStyle: React.CSSProperties = {
  ...appFieldStyle,
  minHeight: 40,
  padding: "8px 10px",
};

const fileInputStyle: React.CSSProperties = {
  ...appFieldStyle,
  minHeight: 40,
  padding: 8,
};

const primaryButtonStyle: React.CSSProperties = {
  ...appPrimaryButtonStyle,
  minHeight: 38,
  padding: "8px 13px",
};

const detailsStyle: React.CSSProperties = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  borderRadius: 8,
  color: "#9a3412",
  margin: "14px 0 0",
  padding: "10px 10px 10px 28px",
};

const importHelpStyle: React.CSSProperties = {
  ...appHelpPanelStyle,
  display: "grid",
  fontSize: 13,
  gap: 6,
  lineHeight: 1.5,
  marginTop: 14,
  padding: 14,
};

const kpiLabelStyle: React.CSSProperties = {
  color: "#64748b",
  display: "block",
  fontSize: 13,
  fontWeight: 600,
};

const kpiValueStyle: React.CSSProperties = {
  display: "block",
  fontSize: 24,
  fontWeight: 600,
  lineHeight: 1.1,
  marginTop: 8,
};

const projectCardStyle: React.CSSProperties = {
  border: "1px solid #dbe3f1",
  borderRadius: 8,
  display: "grid",
  gap: 14,
  padding: 16,
};

const projectListGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 20,
  gridTemplateColumns: "repeat(2, minmax(420px, 1fr))",
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
  ...appBadgeBaseStyle,
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
  fontSize: 20,
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
  gap: 12,
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
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
};

const mobileProjectActionsStyle: React.CSSProperties = {
  gridTemplateColumns: "minmax(0, 1fr)",
};

const secondaryInlineActionStyle: React.CSSProperties = {
  ...appSecondaryButtonStyle,
  color: "#002a4e",
  display: "inline-flex",
  fontSize: 13,
  justifyContent: "center",
  minHeight: 40,
  padding: "8px 12px",
  textDecoration: "none",
};

const dangerButtonStyle: React.CSSProperties = {
  ...appDangerButtonStyle,
  fontSize: 13,
  minHeight: 40,
  padding: "8px 12px",
  whiteSpace: "nowrap",
  width: "100%",
};
