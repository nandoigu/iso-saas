"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getProjectRoleBadgeStyle,
  getProjectRoleLabel,
} from "@/app/lib/projectRoles";
import {
  DestructiveConfirmationDialog,
  type DestructiveConfirmationState,
} from "@/components/DestructiveConfirmationDialog";
import { Notice } from "@/components/Notice";
import {
  appFieldStyle,
  appHelpPanelStyle,
  appPanelStyle,
  appPrimaryButtonStyle,
  appSecondaryButtonStyle,
} from "@/components/uiStyles";
import {
  compareRequirementsNaturally,
  EMPTY_EDIT_DATA,
  formatDate,
  getDeadlineTime,
  getDisplayValue,
  isRequirementOverdue,
  isRequirementUpcoming,
  matchesDateFilter,
  naturalTextCompare,
  normalizeStatus,
  STATUS_META,
  type DateFilter,
  type EditData,
  type Requirement,
  type RequirementStatus,
  type SortMode,
} from "@/app/projects/[id]/project-requirements";
import { useProjectRequirements } from "@/app/projects/[id]/useProjectRequirements";

type ProjectClientProps = {
  projectId: string;
};

type ProjectMeta = {
  id: string;
  name: string;
  code?: string | null;
  role: string;
};

type ImportMode = "append" | "replace";

const PROJECT_FILTERS_STORAGE_PREFIX = "bmo:project-filters:";

export default function ProjectClient({ projectId }: ProjectClientProps) {
  const isMobile = useProjectDetailBreakpoint() === "mobile";
  const { requirements, loading, loadError, reloadRequirements } =
    useProjectRequirements(projectId);
  const [projectMeta, setProjectMeta] = useState<ProjectMeta | null>(null);
  const [metaError, setMetaError] = useState("");
  const [editingProjectMeta, setEditingProjectMeta] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [projectCodeDraft, setProjectCodeDraft] = useState("");
  const [savingProjectMeta, setSavingProjectMeta] = useState(false);

  const [sortMode, setSortMode] = useState<SortMode>("natural");
  const [selectedNorma, setSelectedNorma] = useState("all");
  const [selectedStatuses, setSelectedStatuses] = useState<RequirementStatus[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersHydrated, setFiltersHydrated] = useState(false);

  const [norma, setNorma] = useState("");
  const [item, setItem] = useState("");
  const [name, setName] = useState("");
  const [evidencia, setEvidencia] = useState("");
  const [status, setStatus] = useState<RequirementStatus>("no_conforme");
  const [deadline, setDeadline] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const [importingFile, setImportingFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>("append");
  const [importingRequirements, setImportingRequirements] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const [importDetails, setImportDetails] = useState<string[]>([]);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [confirmation, setConfirmation] =
    useState<DestructiveConfirmationState | null>(null);
  const [generatingBaseRequirements, setGeneratingBaseRequirements] =
    useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<EditData>(EMPTY_EDIT_DATA);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingRequirementId, setDeletingRequirementId] = useState<string | null>(null);

  useEffect(() => {
    const loadProjectMeta = async () => {
      if (!projectId) return;

      setMetaError("");

      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "No se pudo cargar el proyecto.");
        }

        setProjectMeta(data);
        setProjectNameDraft(data.name || "");
        setProjectCodeDraft(data.code || "");
      } catch (error) {
        console.error("Error cargando metadatos del proyecto:", error);
        setMetaError("No se pudo cargar la función del proyecto.");
      }
    };

    loadProjectMeta();
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;

    try {
      const raw = window.localStorage.getItem(
        `${PROJECT_FILTERS_STORAGE_PREFIX}${projectId}`
      );
      const saved = raw ? JSON.parse(raw) : null;

      if (typeof saved?.sortMode === "string") {
        setSortMode(saved.sortMode as SortMode);
      }
      if (typeof saved?.selectedNorma === "string") {
        setSelectedNorma(saved.selectedNorma);
      }
      if (Array.isArray(saved?.selectedStatuses)) {
        setSelectedStatuses(
          saved.selectedStatuses.filter((value: string): value is RequirementStatus =>
            ["total", "parcial", "no_conforme"].includes(value)
          )
        );
      }
      if (typeof saved?.dateFilter === "string") {
        setDateFilter(saved.dateFilter as DateFilter);
      }
      if (typeof saved?.searchTerm === "string") {
        setSearchTerm(saved.searchTerm);
      }
    } catch (error) {
      console.error("Error recuperando filtros del proyecto:", error);
    } finally {
      setFiltersHydrated(true);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !filtersHydrated) return;

    window.localStorage.setItem(
      `${PROJECT_FILTERS_STORAGE_PREFIX}${projectId}`,
      JSON.stringify({
        sortMode,
        selectedNorma,
        selectedStatuses,
        dateFilter,
        searchTerm,
      })
    );
  }, [
    dateFilter,
    filtersHydrated,
    projectId,
    searchTerm,
    selectedNorma,
    selectedStatuses,
    sortMode,
  ]);

  const createRequirement = async () => {
    if (!projectId) {
      setActionError("No se ha detectado el proyecto.");
      setActionSuccess("");
      return;
    }

    if (!name.trim()) {
      setActionError("El requerimiento es obligatorio.");
      setActionSuccess("");
      return;
    }

    setSavingNew(true);
    setActionError("");
    setActionSuccess("");

    try {
      const res = await fetch("/api/requirements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          norma,
          item,
          name,
          evidencia,
          status,
          deadline: deadline || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("ERROR BACKEND CREATE:", data);
        setActionError(data.error || "Error creando requisito");
        return;
      }

      setNorma("");
      setItem("");
      setName("");
      setEvidencia("");
      setStatus("no_conforme");
      setDeadline("");

      await reloadRequirements();
      setActionSuccess("Requerimiento creado correctamente.");
    } catch (error) {
      console.error("ERROR FRONT CREATE:", error);
      setActionError("Error inesperado creando requisito");
    } finally {
      setSavingNew(false);
    }
  };

  const importProjectRequirements = () => {
    if (!projectId) {
      setImportError("No se ha detectado el proyecto.");
      setImportSuccess("");
      return;
    }

    if (!importingFile) {
      setImportError("Selecciona un archivo .xlsx para importar.");
      setImportSuccess("");
      setImportDetails([]);
      return;
    }

    if (importMode === "replace") {
      setConfirmation({
        title: "Reemplazar requerimientos",
        message:
          "¿Quieres reemplazar todos los requerimientos actuales del proyecto por los del Excel?\n\nEsta acción eliminará los requerimientos existentes antes de importar los nuevos y no se puede deshacer.",
        confirmLabel: "Reemplazar e importar",
        onConfirm: () => void confirmProjectRequirementsImport(importingFile),
      });
      return;
    }

    void confirmProjectRequirementsImport(importingFile);
  };

  const confirmProjectRequirementsImport = async (file: File) => {
    setImportingRequirements(true);
    setImportError("");
    setImportSuccess("");
    setImportDetails([]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", importMode);

      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/import-requirements`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setImportDetails(Array.isArray(data.details) ? data.details : []);
        setImportError(
          data.error || "No se pudieron importar los requisitos del proyecto."
        );
        return;
      }

      setImportingFile(null);
      setImportSuccess(buildProjectImportSuccessMessage(data.data));

      const input = document.getElementById(
        "project-requirements-import-file"
      ) as HTMLInputElement | null;

      if (input) {
        input.value = "";
      }

      await reloadRequirements();
    } catch (error) {
      console.error("ERROR FRONT IMPORT PROJECT REQUIREMENTS:", error);
      setImportError("Error inesperado importando requisitos del proyecto.");
    } finally {
      setImportingRequirements(false);
    }
  };

  const startEditing = (requirement: Requirement) => {
    setEditingId(requirement.id);
    setEditData({
      id: requirement.id,
      norma: requirement.norma ?? "",
      item: requirement.item ?? "",
      name: requirement.name ?? "",
      evidencia: requirement.evidencia ?? "",
      status: normalizeStatus(requirement.status),
      deadline: requirement.deadline ? requirement.deadline.slice(0, 10) : "",
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditData(EMPTY_EDIT_DATA);
  };

  const startProjectMetaEditing = () => {
    setProjectNameDraft(projectMeta?.name || "");
    setProjectCodeDraft(projectMeta?.code || "");
    setEditingProjectMeta(true);
    setActionError("");
    setActionSuccess("");
  };

  const cancelProjectMetaEditing = () => {
    setProjectNameDraft(projectMeta?.name || "");
    setProjectCodeDraft(projectMeta?.code || "");
    setEditingProjectMeta(false);
  };

  const saveProjectMeta = async () => {
    if (!projectId) {
      setActionError("No se ha detectado el proyecto.");
      setActionSuccess("");
      return;
    }

    if (!projectNameDraft.trim()) {
      setActionError("El nombre del proyecto es obligatorio.");
      setActionSuccess("");
      return;
    }

    setSavingProjectMeta(true);
    setActionError("");
    setActionSuccess("");

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: projectNameDraft.trim(),
          code: projectCodeDraft.trim() || null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error || "No se pudo actualizar el proyecto.");
        return;
      }

      setProjectMeta({
        id: data.id,
        name: data.name,
        code: data.code,
        role: data.role,
      });
      setProjectNameDraft(data.name || "");
      setProjectCodeDraft(data.code || "");
      setEditingProjectMeta(false);
      setActionSuccess("Metadatos del proyecto actualizados correctamente.");
    } catch (error) {
      console.error("ERROR FRONT SAVE PROJECT META:", error);
      setActionError("Error inesperado actualizando el proyecto.");
    } finally {
      setSavingProjectMeta(false);
    }
  };

  const generateBaseRequirements = async () => {
    if (!projectMeta || generatingBaseRequirements) return;

    setGeneratingBaseRequirements(true);
    setActionError("");
    setActionSuccess("");

    try {
      const res = await fetch("/api/generate-requirements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          role: projectMeta.role,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "No se pudieron cargar los requisitos base."
        );
      }

      await reloadRequirements();
      setActionSuccess(
        `Requisitos base cargados: ${data.data?.created ?? 0} de ${
          data.data?.totalTemplates ?? 0
        }.`
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los requisitos base."
      );
    } finally {
      setGeneratingBaseRequirements(false);
    }
  };

  const saveEditing = async () => {
    if (!editData.id) {
      setActionError("No se ha seleccionado un requisito para editar.");
      setActionSuccess("");
      return;
    }

    if (!editData.name.trim()) {
      setActionError("El requerimiento es obligatorio.");
      setActionSuccess("");
      return;
    }

    setSavingEdit(true);
    setActionError("");
    setActionSuccess("");

    try {
      const res = await fetch("/api/requirements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editData.id,
          norma: editData.norma,
          item: editData.item,
          name: editData.name,
          evidencia: editData.evidencia,
          status: editData.status,
          deadline: editData.deadline || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("ERROR BACKEND EDIT:", data);
        setActionError(data.error || "Error actualizando");
        return;
      }

      cancelEditing();
      await reloadRequirements();
      setActionSuccess("Requerimiento actualizado correctamente.");
    } catch (error) {
      console.error("ERROR FRONT EDIT:", error);
      setActionError("Error inesperado actualizando");
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteRequirement = (requirement: Requirement) => {
    setConfirmation({
      title: "Eliminar requerimiento",
      message: `¿Seguro que quieres eliminar el requerimiento "${getDisplayValue(
        requirement.name,
        "Sin descripción"
      )}"?\n\nEsta acción no se puede deshacer.`,
      confirmLabel: "Eliminar requerimiento",
      onConfirm: () => void confirmDeleteRequirement(requirement),
    });
  };

  const confirmDeleteRequirement = async (requirement: Requirement) => {
    setDeletingRequirementId(requirement.id);
    setActionError("");
    setActionSuccess("");

    try {
      const res = await fetch(
        `/api/requirements?id=${encodeURIComponent(requirement.id)}`,
        {
          method: "DELETE",
        }
      );
      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error || "No se pudo eliminar el requerimiento.");
        return;
      }

      if (editingId === requirement.id) {
        cancelEditing();
      }

      await reloadRequirements();
      setActionSuccess("Requerimiento eliminado correctamente.");
    } catch (error) {
      console.error("ERROR FRONT DELETE REQUIREMENT:", error);
      setActionError("Error inesperado eliminando requisito.");
    } finally {
      setDeletingRequirementId(null);
    }
  };

  const summary = useMemo(() => {
    const total = requirements.length;
    const score = requirements.reduce((sum, requirement) => {
      const currentStatus = normalizeStatus(requirement.status);

      if (currentStatus === "total") return sum + 1;
      if (currentStatus === "parcial") return sum + 0.5;
      return sum;
    }, 0);

    const overdue = requirements.filter(isRequirementOverdue).length;
    const upcoming = requirements.filter((requirement) =>
      isRequirementUpcoming(requirement)
    ).length;
    const statusCounts = requirements.reduce(
      (counts, requirement) => {
        counts[normalizeStatus(requirement.status)] += 1;
        return counts;
      },
      { total: 0, parcial: 0, no_conforme: 0 } as Record<
        RequirementStatus,
        number
      >
    );

    return {
      total,
      overdue,
      upcoming,
      statusCounts,
      percent: total > 0 ? Math.round((score / total) * 100) : 0,
    };
  }, [requirements]);

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
    const filtered = requirements.filter((requirement) => {
      const currentStatus = normalizeStatus(requirement.status);
      const normaValue = getDisplayValue(requirement.norma, "Sin norma");

      if (selectedNorma !== "all" && normaValue !== selectedNorma) {
        return false;
      }

      if (
        selectedStatuses.length > 0 &&
        !selectedStatuses.includes(currentStatus)
      ) {
        return false;
      }

      if (!matchesDateFilter(requirement, dateFilter)) {
        return false;
      }

      if (searchTerm.trim()) {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        const haystack = [
          requirement.norma,
          requirement.item,
          requirement.name,
          requirement.evidencia,
        ]
          .map((value) => String(value ?? "").toLowerCase())
          .join(" ");

        if (!haystack.includes(normalizedSearch)) {
          return false;
        }
      }

      return true;
    });

    return filtered.sort((left, right) => {
      if (sortMode === "natural") {
        return compareRequirementsNaturally(left, right);
      }

      if (sortMode === "status") {
        return (
          STATUS_META[normalizeStatus(left.status)].order -
            STATUS_META[normalizeStatus(right.status)].order ||
          compareRequirementsNaturally(left, right)
        );
      }

      if (sortMode === "deadline") {
        const leftTime = getDeadlineTime(left.deadline);
        const rightTime = getDeadlineTime(right.deadline);
        return leftTime - rightTime || compareRequirementsNaturally(left, right);
      }

      return 0;
    });
  }, [requirements, selectedNorma, selectedStatuses, dateFilter, sortMode, searchTerm]);

  const activeFilterCount =
    (selectedNorma !== "all" ? 1 : 0) +
    selectedStatuses.length +
    (dateFilter !== "all" ? 1 : 0) +
    (searchTerm.trim() ? 1 : 0);

  const toggleStatusFilter = (nextStatus: RequirementStatus) => {
    setSelectedStatuses((current) =>
      current.includes(nextStatus)
        ? current.filter((statusItem) => statusItem !== nextStatus)
        : [...current, nextStatus]
    );
  };

  const resetFilters = () => {
    setSelectedNorma("all");
    setSelectedStatuses([]);
    setDateFilter("all");
    setSortMode("natural");
    setSearchTerm("");
  };

  return (
    <main style={{ ...pageStyle, ...(isMobile ? mobilePageStyle : {}) }}>
      <DestructiveConfirmationDialog
        confirmation={confirmation}
        onCancel={() => setConfirmation(null)}
      />

      <header
        style={{
          alignItems: "flex-start",
          display: isMobile ? "grid" : "flex",
          flexWrap: "wrap",
          gap: 20,
          justifyContent: "space-between",
          marginBottom: 28,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={eyebrowStyle}>Workspace de requerimientos</div>
          <div
            style={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 8,
            }}
          >
            <span
              style={{
                ...projectRoleBadgeBaseStyle,
                ...getProjectRoleBadgeStyle(projectMeta?.role),
              }}
            >
              {getProjectRoleLabel(projectMeta?.role)}
            </span>
            {projectMeta?.code ? (
              <span style={projectMetaStyle}>{projectMeta.code}</span>
            ) : null}
          </div>
          {editingProjectMeta ? (
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #dbe5f1",
                borderRadius: 12,
                marginTop: 8,
                maxWidth: 760,
                padding: 16,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: isMobile
                    ? "minmax(0, 1fr)"
                    : "minmax(0, 1.2fr) minmax(220px, 0.8fr)",
                }}
              >
                <label style={inlineFieldStyle}>
                  Nombre del proyecto
                  <input
                    value={projectNameDraft}
                    onChange={(event) => setProjectNameDraft(event.target.value)}
                    style={controlStyle}
                  />
                </label>
                <label style={inlineFieldStyle}>
                  Código
                  <input
                    value={projectCodeDraft}
                    onChange={(event) => setProjectCodeDraft(event.target.value)}
                    style={controlStyle}
                  />
                </label>
              </div>
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  justifyContent: "space-between",
                  marginTop: 12,
                }}
              >
                <span style={{ color: "#64748b", fontSize: 13 }}>
                  La función del proyecto se mantiene fija para no desalinear
                  los requerimientos generados automáticamente.
                </span>
                <div
                  style={{
                    display: isMobile ? "grid" : "flex",
                    gap: 10,
                    width: isMobile ? "100%" : undefined,
                  }}
                >
                  <button
                    type="button"
                    onClick={cancelProjectMetaEditing}
                    disabled={savingProjectMeta}
                    style={secondaryButtonStyle}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveProjectMeta}
                    disabled={savingProjectMeta}
                    style={primaryButtonStyle}
                  >
                    {savingProjectMeta ? "Guardando..." : "Guardar proyecto"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  justifyContent: "space-between",
                }}
              >
                <h2 style={{ margin: 0 }}>
                  {projectMeta?.name || "Gestion de requerimientos"}
                </h2>
                <button
                  type="button"
                  onClick={startProjectMetaEditing}
                  style={secondaryButtonStyle}
                >
                  Editar proyecto
                </button>
              </div>
              <p style={{ color: "#6b7280", margin: "8px 0 0" }}>
                Alta, edición y seguimiento de requerimientos, evidencias, estados y
                fechas límite del proyecto.
              </p>
            </>
          )}
          {metaError ? (
            <p style={{ color: "#b91c1c", margin: "8px 0 0" }}>{metaError}</p>
          ) : null}
        </div>

        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            width: isMobile ? "100%" : undefined,
          }}
        >
          <Link href="/projects" style={linkButtonStyle}>
            Volver a proyectos
          </Link>
          <Link href={`/projects/${projectId}/matrix`} style={linkButtonStyle}>
            Ver matriz de cumplimiento
          </Link>
          <Link
            href={`/dashboard?projectId=${encodeURIComponent(projectId)}`}
            style={linkButtonStyle}
          >
            Ver en dashboard
          </Link>
        </div>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <MetricCard label="Requerimientos" value={summary.total} />
        <MetricCard label="Cumplimiento" value={`${summary.percent}%`} />
        <MetricCard label="Próximos 7 días" value={summary.upcoming} tone="warning" />
        <MetricCard label="Vencidos" value={summary.overdue} tone="risk" />
      </section>

      <section style={quickNavStyle}>
        <div style={{ minWidth: 0 }}>
          <strong style={{ display: "block" }}>Flujo de trabajo</strong>
          <span style={{ color: "#64748b", fontSize: 13 }}>
            Alta, importación, revisión filtrada y matriz quedan conectadas desde aquí.
            Los filtros se conservan al volver a este proyecto.
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            justifyContent: isMobile ? "stretch" : "flex-end",
          }}
        >
          <a href="#nuevo-requerimiento" style={quickNavLinkStyle}>
            Nuevo
          </a>
          <a href="#importar-requerimientos" style={quickNavLinkStyle}>
            Importar
          </a>
          <a href="#filtros-requerimientos" style={quickNavLinkStyle}>
            Filtrar
          </a>
          <a href="#listado-requerimientos" style={quickNavLinkStyle}>
            Revisar
          </a>
        </div>
      </section>

      {(actionError || actionSuccess) && (
        <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
          {actionError ? (
            <Notice tone="error" message={actionError} compact />
          ) : null}
          {actionSuccess ? (
            <Notice tone="success" message={actionSuccess} compact />
          ) : null}
        </div>
      )}

      <section
        style={{
          display: "grid",
          gap: 18,
          gridTemplateColumns: isMobile
            ? "minmax(0, 1fr)"
            : "repeat(auto-fit, minmax(340px, 1fr))",
          marginBottom: 24,
        }}
      >
        <section id="nuevo-requerimiento" style={panelStyle}>
          <SectionHeader
            eyebrow="Alta manual"
            title="Nuevo requerimiento"
            description="Registra nuevos requisitos del proyecto con su estado, evidencia y fecha límite desde un único bloque operativo."
          />

          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: isMobile
                ? "minmax(0, 1fr)"
                : "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            <label style={inlineFieldStyle}>
              Norma
              <input
                placeholder="ISO 19650-2"
                value={norma}
                onChange={(event) => setNorma(event.target.value)}
                style={controlStyle}
              />
            </label>

            <label style={inlineFieldStyle}>
              Item
              <input
                placeholder="5.1.2"
                value={item}
                onChange={(event) => setItem(event.target.value)}
                style={controlStyle}
              />
            </label>

            <label style={inlineFieldStyle}>
              Estado
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as RequirementStatus)
                }
                style={controlStyle}
              >
                <option value="total">Total</option>
                <option value="parcial">Parcial</option>
                <option value="no_conforme">No conforme</option>
              </select>
            </label>

            <label style={inlineFieldStyle}>
              Fecha límite
              <input
                type="date"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
                style={controlStyle}
              />
            </label>
          </div>

          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: isMobile
                ? "minmax(0, 1fr)"
                : "minmax(0, 1.2fr) minmax(0, 0.8fr)",
              marginTop: 12,
            }}
          >
            <label style={inlineFieldStyle}>
              Requerimiento
              <textarea
                placeholder="Descripcion del requerimiento"
                value={name}
                onChange={(event) => setName(event.target.value)}
                rows={4}
                style={textAreaStyle}
              />
            </label>

            <label style={inlineFieldStyle}>
              Evidencia
              <textarea
                placeholder="Documento, enlace, responsable o nota de evidencia"
                value={evidencia}
                onChange={(event) => setEvidencia(event.target.value)}
                rows={4}
                style={textAreaStyle}
              />
            </label>
          </div>

          <button
            onClick={createRequirement}
            disabled={savingNew}
            style={{
              ...primaryButtonStyle,
              marginTop: 14,
              opacity: savingNew ? 0.7 : 1,
            }}
          >
            {savingNew ? "Guardando..." : "Añadir requerimiento"}
          </button>
        </section>

        <section id="importar-requerimientos" style={panelStyle}>
          <SectionHeader
            eyebrow="Carga masiva"
            title="Importar requisitos del proyecto"
            description="Sube un Excel específico para este proyecto. Puedes añadir solo nuevos requerimientos o reemplazar por completo el listado actual."
          />

          <div
            style={{
              alignItems: "end",
              display: "grid",
              gap: 12,
              gridTemplateColumns: isMobile
                ? "minmax(0, 1fr)"
                : "repeat(2, minmax(0, 1fr))",
            }}
          >
            <label style={filterLabelStyle}>
              Archivo .xlsx
              <input
                id="project-requirements-import-file"
                type="file"
                accept=".xlsx"
                onChange={(event) =>
                  setImportingFile(event.target.files?.[0] || null)
                }
                style={controlStyle}
              />
            </label>

            <label style={filterLabelStyle}>
              Modo de importación
              <select
                value={importMode}
                onChange={(event) =>
                  setImportMode(event.target.value as ImportMode)
                }
                style={controlStyle}
              >
                <option value="append">Añadir solo nuevos</option>
                <option value="replace">Reemplazar requerimientos del proyecto</option>
              </select>
            </label>

            <button
              type="button"
              onClick={importProjectRequirements}
              disabled={importingRequirements}
              style={{
                ...primaryButtonStyle,
                gridColumn: isMobile ? undefined : "1 / -1",
                justifySelf: isMobile ? "stretch" : "end",
                minWidth: isMobile ? undefined : 180,
                opacity: importingRequirements ? 0.7 : 1,
                width: isMobile ? "100%" : undefined,
              }}
            >
              {importingRequirements ? "Importando..." : "Importar Excel"}
            </button>
          </div>

          <div style={importHelpStyle}>
            <strong>Formato Excel del proyecto</strong>
            <p>
              La primera fila debe contener <code> norma </code>, <code> item </code>,
              <code> requerimiento </code>, <code> evidencia </code>, <code> estado </code>
              y <code> fecha_limite </code>. También se aceptan encabezados con acentos,
              como <code> descripción </code> o <code> fecha límite </code>.
            </p>
            <p>
              Estados válidos: <code>total</code>, <code>parcial</code> y
              <code>no_conforme</code>. Las fechas deben venir como fecha de Excel o en
              formato <code>YYYY-MM-DD</code>.
            </p>
          </div>

          {importError ? (
            <Notice
              tone="error"
              message={importError}
              compact
              style={{ marginTop: 14 }}
            />
          ) : null}

          {importDetails.length > 0 ? (
            <ul style={detailsListStyle}>
              {importDetails.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}

          {importSuccess ? (
            <Notice
              tone="success"
              message={importSuccess}
              compact
              style={{ marginTop: 14 }}
            />
          ) : null}
        </section>
      </section>

      <section style={{ marginBottom: 30 }}>
        <FilterPanel
          normaOptions={normaOptions}
          selectedNorma={selectedNorma}
          selectedStatuses={selectedStatuses}
          dateFilter={dateFilter}
          activeFilterCount={activeFilterCount}
          totalCount={requirements.length}
          filteredCount={filteredRequirements.length}
          searchTerm={searchTerm}
          onNormaChange={setSelectedNorma}
          onStatusToggle={toggleStatusFilter}
          onDateFilterChange={setDateFilter}
          onSearchTermChange={setSearchTerm}
          onReset={resetFilters}
          compactLayout={isMobile}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
        />

        <div
          id="listado-requerimientos"
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Requerimientos</h3>
            <span style={{ color: "#6b7280", fontSize: 13 }}>
              {filteredRequirements.length} de {summary.total} registros
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <StatusBadge
              status="total"
              label={`Total ${summary.statusCounts.total}`}
              compact
            />
            <StatusBadge
              status="parcial"
              label={`Parcial ${summary.statusCounts.parcial}`}
              compact
            />
            <StatusBadge
              status="no_conforme"
              label={`No conforme ${summary.statusCounts.no_conforme}`}
              compact
            />
          </div>
        </div>

        {loading && (
          <EmptyState
            title="Cargando"
            description="Obteniendo requerimientos del proyecto."
          />
        )}

        {!loading && loadError && (
          <EmptyState title="Error de carga" description={loadError} tone="risk" />
        )}

        {!loading && !loadError && filteredRequirements.length === 0 && (
          <EmptyState
            title={requirements.length === 0 ? "Sin requerimientos" : "Sin resultados"}
            description={
              requirements.length === 0
                ? "Carga los requisitos base de la función del proyecto o añade requisitos manualmente."
                : "No hay requerimientos que coincidan con los filtros activos."
            }
            action={
              requirements.length === 0 && projectMeta ? (
                <button
                  type="button"
                  onClick={generateBaseRequirements}
                  disabled={generatingBaseRequirements}
                  style={{
                    ...primaryButtonStyle,
                    marginTop: 14,
                    opacity: generatingBaseRequirements ? 0.65 : 1,
                    cursor: generatingBaseRequirements ? "wait" : "pointer",
                  }}
                >
                  {generatingBaseRequirements
                    ? "Cargando requisitos..."
                    : `Cargar requisitos base (${getProjectRoleLabel(
                        projectMeta.role
                      )})`}
                </button>
              ) : null
            }
          />
        )}

        {!loading && !loadError && filteredRequirements.length > 0 && (
          <div style={{ display: "grid", gap: 14 }}>
            {filteredRequirements.map((requirement) => (
              <RequirementCard
                key={requirement.id}
                requirement={requirement}
                editing={editingId === requirement.id}
                editData={editData}
                savingEdit={savingEdit}
                deletingRequirement={deletingRequirementId === requirement.id}
                onStartEditing={startEditing}
                onCancelEditing={cancelEditing}
                onSaveEditing={saveEditing}
                onEditChange={setEditData}
                onDeleteRequirement={deleteRequirement}
                compactLayout={isMobile}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function RequirementCard({
  requirement,
  editing,
  editData,
  savingEdit,
  deletingRequirement,
  onStartEditing,
  onCancelEditing,
  onSaveEditing,
  onEditChange,
  onDeleteRequirement,
  compactLayout,
}: {
  requirement: Requirement;
  editing: boolean;
  editData: EditData;
  savingEdit: boolean;
  deletingRequirement: boolean;
  onStartEditing: (requirement: Requirement) => void;
  onCancelEditing: () => void;
  onSaveEditing: () => void;
  onEditChange: (data: EditData) => void;
  onDeleteRequirement: (requirement: Requirement) => void;
  compactLayout: boolean;
}) {
  const currentStatus = normalizeStatus(requirement.status);
  const overdue = isRequirementOverdue(requirement);
  const upcoming = isRequirementUpcoming(requirement);

  return (
    <article
      style={{
        background: "white",
        border: `1px solid ${overdue ? "#fecaca" : "#e5e7eb"}`,
        borderLeft: `5px solid ${
          overdue ? "#dc2626" : STATUS_META[currentStatus].color
        }`,
        borderRadius: 12,
        boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
        padding: compactLayout ? 14 : 18,
      }}
    >
      {editing ? (
        <EditRequirementForm
          editData={editData}
          savingEdit={savingEdit}
          onCancelEditing={onCancelEditing}
          onSaveEditing={onSaveEditing}
          onEditChange={onEditChange}
          compactLayout={compactLayout}
        />
      ) : (
        <>
          <div
            style={{
              alignItems: "flex-start",
              display: compactLayout ? "grid" : "flex",
              flexWrap: "wrap",
              gap: 12,
              justifyContent: "space-between",
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  alignItems: "center",
                  color: "#6b7280",
                  display: "flex",
                  flexWrap: "wrap",
                  fontSize: 12,
                  fontWeight: 700,
                  gap: 8,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                <span>
                  {getDisplayValue(requirement.norma, "Sin norma")} /{" "}
                  {getDisplayValue(requirement.item, "Sin item")}
                </span>
                {overdue ? <OverdueBadge compact /> : null}
                <StatusBadge status={currentStatus} compact />
              </div>

              <h4
                style={{
                  fontSize: 16,
                  lineHeight: 1.35,
                  margin: "6px 0 0",
                  maxWidth: compactLayout ? "100%" : "92%",
                }}
              >
                {getDisplayValue(requirement.name, "Sin descripción")}
              </h4>
            </div>

            <div
              style={{
                display: compactLayout ? "grid" : "flex",
                gap: 8,
                width: compactLayout ? "100%" : undefined,
              }}
            >
              <button
                onClick={() => onStartEditing(requirement)}
                disabled={deletingRequirement}
                style={{
                  ...compactActionButtonStyle,
                  width: compactLayout ? "100%" : undefined,
                }}
              >
                Editar
              </button>
              <button
                onClick={() => onDeleteRequirement(requirement)}
                disabled={deletingRequirement}
                style={{
                  ...compactDangerButtonStyle,
                  opacity: deletingRequirement ? 0.6 : 1,
                  cursor: deletingRequirement ? "not-allowed" : "pointer",
                  width: compactLayout ? "100%" : undefined,
                }}
              >
                {deletingRequirement ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: compactLayout
                ? "minmax(0, 1fr)"
                : "minmax(0, 1.4fr) repeat(3, minmax(120px, 0.8fr))",
              marginTop: 12,
            }}
          >
            <InfoBlock
              label="Evidencia"
              value={getDisplayValue(requirement.evidencia, "Sin evidencia")}
              compact
            />
            <InfoBlock
              label="Fecha límite"
              value={formatDate(requirement.deadline)}
              tone={overdue ? "risk" : upcoming ? "warning" : "default"}
              compact
            />
            <InfoBlock
              label="Seguimiento"
              value={overdue ? "Vencido" : upcoming ? "Proximo" : "En plazo"}
              tone={overdue ? "risk" : upcoming ? "warning" : "default"}
              compact
            />
            <InfoBlock
              label="Estado"
              value={STATUS_META[currentStatus].label}
              tone={overdue ? "risk" : "default"}
              compact
            />
          </div>
        </>
      )}
    </article>
  );
}

function EditRequirementForm({
  editData,
  savingEdit,
  onCancelEditing,
  onSaveEditing,
  onEditChange,
  compactLayout,
}: {
  editData: EditData;
  savingEdit: boolean;
  onCancelEditing: () => void;
  onSaveEditing: () => void;
  onEditChange: (data: EditData) => void;
  compactLayout: boolean;
}) {
  const editStatusMeta = STATUS_META[editData.status];

  return (
    <>
      <div
        style={{
          alignItems: "center",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "space-between",
          marginBottom: 16,
          padding: "12px 14px",
        }}
      >
        <div>
          <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
            Modo edición
          </div>
          <div style={{ color: "#0f172a", fontSize: 14, fontWeight: 700, marginTop: 4 }}>
            Ajusta el requerimiento directamente en contexto y guarda los cambios.
          </div>
        </div>

        <div style={{ alignItems: "center", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              background: editStatusMeta.background,
              border: `1px solid ${editStatusMeta.border}`,
              borderRadius: 999,
              color: editStatusMeta.color,
              display: "inline-flex",
              fontSize: 12,
              fontWeight: 800,
              padding: "5px 10px",
            }}
          >
            {editStatusMeta.label}
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: compactLayout
            ? "minmax(0, 1fr)"
            : "repeat(auto-fit, minmax(160px, 1fr))",
        }}
      >
        <label style={inlineFieldStyle}>
          Norma
          <input
            value={editData.norma}
            onChange={(event) =>
              onEditChange({ ...editData, norma: event.target.value })
            }
            placeholder="Norma"
            style={controlStyle}
          />
        </label>

        <label style={inlineFieldStyle}>
          Item
          <input
            value={editData.item}
            onChange={(event) =>
              onEditChange({ ...editData, item: event.target.value })
            }
            placeholder="Item"
            style={controlStyle}
          />
        </label>

        <label style={inlineFieldStyle}>
          Estado
          <select
            value={editData.status}
            onChange={(event) =>
              onEditChange({
                ...editData,
                status: event.target.value as RequirementStatus,
              })
            }
            style={controlStyle}
          >
            <option value="total">Total</option>
            <option value="parcial">Parcial</option>
            <option value="no_conforme">No conforme</option>
          </select>
        </label>

        <label style={inlineFieldStyle}>
          Fecha límite
          <input
            type="date"
            value={editData.deadline}
            onChange={(event) =>
              onEditChange({ ...editData, deadline: event.target.value })
            }
            style={controlStyle}
          />
        </label>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: compactLayout
            ? "minmax(0, 1fr)"
            : "minmax(0, 1.2fr) minmax(0, 0.8fr)",
          marginTop: 14,
        }}
      >
        <label style={inlineFieldStyle}>
          Requerimiento
          <textarea
            value={editData.name}
            onChange={(event) =>
              onEditChange({ ...editData, name: event.target.value })
            }
            placeholder="Descripción"
            rows={4}
            style={textAreaStyle}
          />
        </label>

        <label style={inlineFieldStyle}>
          Evidencia
          <textarea
            value={editData.evidencia}
            onChange={(event) =>
              onEditChange({ ...editData, evidencia: event.target.value })
            }
            placeholder="Evidencia"
            rows={4}
            style={textAreaStyle}
          />
        </label>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          justifyContent: "flex-end",
          marginTop: 14,
          paddingTop: 14,
          borderTop: "1px solid #e5e7eb",
        }}
      >
        <span style={{ color: "#64748b", fontSize: 13, marginRight: "auto" }}>
          Los cambios se aplican solo a este requerimiento dentro del proyecto.
        </span>
        <button
          onClick={onCancelEditing}
          disabled={savingEdit}
          style={secondaryButtonStyle}
        >
          Cancelar
        </button>
        <button
          onClick={onSaveEditing}
          disabled={savingEdit}
          style={primaryButtonStyle}
        >
          {savingEdit ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </>
  );
}

function FilterPanel({
  normaOptions,
  selectedNorma,
  selectedStatuses,
  dateFilter,
  activeFilterCount,
  totalCount,
  filteredCount,
  searchTerm,
  onNormaChange,
  onStatusToggle,
  onDateFilterChange,
  onSearchTermChange,
  onReset,
  compactLayout,
  sortMode,
  onSortModeChange,
}: {
  normaOptions: string[];
  selectedNorma: string;
  selectedStatuses: RequirementStatus[];
  dateFilter: DateFilter;
  activeFilterCount: number;
  totalCount: number;
  filteredCount: number;
  searchTerm: string;
  onNormaChange: (value: string) => void;
  onStatusToggle: (status: RequirementStatus) => void;
  onDateFilterChange: (value: DateFilter) => void;
  onSearchTermChange: (value: string) => void;
  onReset: () => void;
  compactLayout: boolean;
  sortMode: SortMode;
  onSortModeChange: (value: SortMode) => void;
}) {
  return (
    <section
      id="filtros-requerimientos"
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
        marginBottom: 20,
        padding: 18,
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>Filtros y ordenación</h3>
          <p style={{ color: "#6b7280", fontSize: 13, margin: "6px 0 0" }}>
            {filteredCount} de {totalCount} requerimientos visibles
            {activeFilterCount > 0
              ? ` - ${activeFilterCount} filtros activos`
              : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={onReset}
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

      <div
        style={{
          alignItems: "start",
          display: "grid",
          gap: 14,
          gridTemplateColumns: compactLayout
            ? "minmax(0, 1fr)"
            : "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <label style={filterLabelStyle}>
          Buscar
          <input
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Norma, item, descripción o evidencia"
            style={controlStyle}
          />
        </label>

        <label style={filterLabelStyle}>
          Norma
          <select
            value={selectedNorma}
            onChange={(event) => onNormaChange(event.target.value)}
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

        <div style={filterLabelStyle}>
          Estado
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(Object.keys(STATUS_META) as RequirementStatus[]).map((status) => {
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
                    onChange={() => onStatusToggle(status)}
                  />
                  {meta.label}
                </label>
              );
            })}
          </div>
        </div>

        <label style={filterLabelStyle}>
          Fecha
          <select
            value={dateFilter}
            onChange={(event) =>
              onDateFilterChange(event.target.value as DateFilter)
            }
            style={controlStyle}
          >
            <option value="all">Todas las fechas</option>
            <option value="overdue">Vencidos</option>
            <option value="upcoming">Próximos 7 días</option>
            <option value="no_date">Sin fecha</option>
          </select>
        </label>

        <label style={filterLabelStyle}>
          Ordenar por
          <select
            value={sortMode}
            onChange={(event) =>
              onSortModeChange(event.target.value as SortMode)
            }
            style={controlStyle}
          >
            <option value="natural">Norma e item</option>
            <option value="deadline">Fecha límite</option>
            <option value="status">Estado</option>
            <option value="created">Orden original</option>
          </select>
        </label>
      </div>
    </section>
  );
}

function buildProjectImportSuccessMessage(data: {
  imported: number;
  skippedDuplicates: number;
  totalRows: number;
  removedExisting?: number;
  mode?: string;
}) {
  if (data.mode === "replace") {
    return `Importación completada en modo reemplazo: ${data.imported} requisitos cargados, ${data.removedExisting ?? 0} requisitos anteriores eliminados y ${data.totalRows} filas válidas procesadas.`;
  }

  return `Importación completada: ${data.imported} nuevos, ${data.skippedDuplicates} duplicados omitidos, ${data.totalRows} filas válidas.`;
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={sectionEyebrowStyle}>{eyebrow}</div>
      <h3 style={{ margin: "0 0 8px" }}>{title}</h3>
      <p style={{ color: "#6b7280", lineHeight: 1.55, margin: 0 }}>
        {description}
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "risk" | "warning";
}) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 18,
      }}
    >
      <div style={{ color: "#6b7280", fontSize: 12 }}>{label}</div>
      <div
        style={{
          color:
            tone === "risk"
              ? "#dc2626"
              : tone === "warning"
                ? "#b45309"
                : "#111827",
          fontSize: 26,
          fontWeight: 700,
          marginTop: 6,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function InfoBlock({
  label,
  value,
  tone = "default",
  compact = false,
}: {
  label: string;
  value: string;
  tone?: "default" | "risk" | "warning";
  compact?: boolean;
}) {
  return (
    <div
      style={{
        background: "#f9fafb",
        borderRadius: 10,
        minWidth: 0,
        padding: compact ? "10px 12px" : 12,
      }}
    >
      <div
        style={{
          color: "#6b7280",
          fontSize: 11,
          marginBottom: compact ? 3 : 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color:
            tone === "risk"
              ? "#b91c1c"
              : tone === "warning"
                ? "#b45309"
                : "#111827",
          fontSize: compact ? 13 : 14,
          fontWeight: 600,
          lineHeight: 1.4,
          wordBreak: "break-word",
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
  compact = false,
}: {
  status: RequirementStatus;
  label?: string;
  compact?: boolean;
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
        fontSize: compact ? 11 : 12,
        fontWeight: 700,
        padding: compact ? "4px 8px" : "5px 10px",
        whiteSpace: "nowrap",
      }}
    >
      {label || meta.label}
    </span>
  );
}

function OverdueBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      style={{
        background: "#fee2e2",
        border: "1px solid #fca5a5",
        borderRadius: 999,
        color: "#991b1b",
        display: "inline-flex",
        fontSize: compact ? 11 : 12,
        fontWeight: 700,
        padding: compact ? "4px 8px" : "5px 10px",
        whiteSpace: "nowrap",
      }}
    >
      Vencido
    </span>
  );
}

function EmptyState({
  title,
  description,
  action,
  tone = "default",
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  tone?: "default" | "risk";
}) {
  return (
    <div
      style={{
        background: tone === "risk" ? "#fef2f2" : "white",
        border: `1px dashed ${tone === "risk" ? "#fca5a5" : "#d1d5db"}`,
        borderRadius: 12,
        color: tone === "risk" ? "#991b1b" : "#6b7280",
        padding: 24,
        textAlign: "center",
      }}
    >
      <strong style={{ color: tone === "risk" ? "#991b1b" : "#374151" }}>
        {title}
      </strong>
      <p style={{ margin: "6px 0 0" }}>{description}</p>
      {action}
    </div>
  );
}

function useProjectDetailBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<"mobile" | "desktop">("desktop");

  useEffect(() => {
    const updateBreakpoint = () => {
      setBreakpoint(window.innerWidth < 760 ? "mobile" : "desktop");
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
  ...appFieldStyle,
  minHeight: 40,
};

const filterLabelStyle: React.CSSProperties = {
  color: "#374151",
  display: "grid",
  fontSize: 13,
  fontWeight: 700,
  gap: 8,
};

const primaryButtonStyle: React.CSSProperties = {
  ...appPrimaryButtonStyle,
};

const secondaryButtonStyle: React.CSSProperties = {
  ...appSecondaryButtonStyle,
};

const linkButtonStyle: React.CSSProperties = {
  ...appSecondaryButtonStyle,
  display: "inline-flex",
  textDecoration: "none",
};

const detailsListStyle: React.CSSProperties = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  borderRadius: 8,
  color: "#9a3412",
  marginTop: 14,
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

const projectRoleBadgeBaseStyle: React.CSSProperties = {
  borderRadius: 999,
  display: "inline-flex",
  fontSize: 12,
  fontWeight: 800,
  padding: "6px 10px",
};

const projectMetaStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const inlineFieldStyle: React.CSSProperties = {
  color: "#334155",
  display: "grid",
  fontSize: 12,
  fontWeight: 700,
  gap: 8,
};

const pageStyle: React.CSSProperties = {
  background: "#f4f6fc",
  minHeight: "calc(100vh - 65px)",
  padding: "28px clamp(20px, 3vw, 36px) 40px",
};

const mobilePageStyle: React.CSSProperties = {
  padding: "20px 12px 32px",
};

const panelStyle: React.CSSProperties = {
  ...appPanelStyle,
  padding: 20,
};

const quickNavStyle: React.CSSProperties = {
  ...appPanelStyle,
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 14,
  justifyContent: "space-between",
  marginBottom: 20,
  padding: 14,
};

const quickNavLinkStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #dbe5f1",
  borderRadius: 8,
  color: "#1d4ed8",
  display: "inline-flex",
  fontSize: 13,
  fontWeight: 800,
  justifyContent: "center",
  minHeight: 36,
  padding: "8px 12px",
  textDecoration: "none",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#0025df",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.04em",
  marginBottom: 10,
  textTransform: "uppercase",
};

const sectionEyebrowStyle: React.CSSProperties = {
  color: "#2563eb",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.06em",
  marginBottom: 8,
  textTransform: "uppercase",
};

const textAreaStyle: React.CSSProperties = {
  ...controlStyle,
  minHeight: 110,
  padding: "10px 12px",
  resize: "vertical",
};

const compactActionButtonStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  color: "#111827",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
  minHeight: 36,
  padding: "7px 12px",
  whiteSpace: "nowrap",
};

const compactDangerButtonStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #fecaca",
  borderRadius: 8,
  color: "#b91c1c",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
  minHeight: 36,
  padding: "7px 12px",
  whiteSpace: "nowrap",
};
