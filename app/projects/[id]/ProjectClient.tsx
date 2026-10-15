"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  getProjectRoleBadgeStyle,
  getProjectRoleLabel,
} from "@/app/lib/projectRoles";
import {
  DestructiveConfirmationDialog,
  type DestructiveConfirmationState,
} from "@/components/DestructiveConfirmationDialog";
import { EmptyState } from "@/components/EmptyState";
import { Notice } from "@/components/Notice";
import {
  appBadgeBaseStyle,
  appFieldStyle,
  appHelpPanelStyle,
  appPanelStyle,
  appPrimaryButtonStyle,
  appSecondaryButtonStyle,
  getActionStateStyle,
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
import RequirementEvidencePanel from "./RequirementEvidencePanel";
import ProjectDocumentsSection from "./ProjectDocumentsSection";

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

// La vista activa vive en la URL (?vista=documentacion) para poder enlazarla y volver atras.
type Vista = "requerimientos" | "documentacion";
type Formulario = "nuevo" | "importar" | null;

const VISTAS: Vista[] = ["requerimientos", "documentacion"];
const VISTA_ETIQUETA: Record<Vista, string> = {
  requerimientos: "Requerimientos",
  documentacion: "Documentación",
};

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
  // Todo el estado de subida vive en RequirementEvidencePanel; aqui solo cual esta abierto.
  const [requisitoAbierto, setRequisitoAbierto] = useState<string | null>(null);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [formulario, setFormulario] = useState<Formulario>(null);
  const [totalPlantillas, setTotalPlantillas] = useState<number | null>(null);

  const searchParams = useSearchParams();
  // Los enlaces antiguos apuntaban al ancla #documentacion de la pagina unica. No se
  // reescribe la URL al montar: el router de Next la restaura durante la hidratacion.
  const [anclaDocumentacion, setAnclaDocumentacion] = useState(false);
  useEffect(() => {
    setAnclaDocumentacion(window.location.hash === "#documentacion");
  }, []);
  const parametroVista = searchParams.get("vista");
  const vista: Vista =
    parametroVista === "documentacion" || (!parametroVista && anclaDocumentacion)
      ? "documentacion"
      : "requerimientos";
  const pestanasVista = useRef<Partial<Record<Vista, HTMLButtonElement | null>>>({});

  const cambiarVista = (nueva: Vista, enfocar = false) => {
    setAnclaDocumentacion(false);
    const params = new URLSearchParams(searchParams.toString());
    if (nueva === "documentacion") {
      params.set("vista", nueva);
    } else {
      params.delete("vista");
    }
    const query = params.toString();
    window.history.pushState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`
    );
    if (enfocar) pestanasVista.current[nueva]?.focus();
  };

  // Patron WAI-ARIA de pestanas: flechas, Inicio y Fin mueven el foco y activan.
  const alTeclearVista = (event: KeyboardEvent<HTMLDivElement>) => {
    const i = VISTAS.indexOf(vista);
    const destino =
      event.key === "ArrowRight"
        ? VISTAS[(i + 1) % VISTAS.length]
        : event.key === "ArrowLeft"
          ? VISTAS[(i - 1 + VISTAS.length) % VISTAS.length]
          : event.key === "Home"
            ? VISTAS[0]
            : event.key === "End"
              ? VISTAS[VISTAS.length - 1]
              : null;
    if (!destino) return;
    event.preventDefault();
    cambiarVista(destino, true);
  };

  // Alta e importacion son tareas puntuales: se abren a demanda y nunca las dos a la vez.
  const alternarFormulario = (destino: Exclude<Formulario, null>) => {
    setFormulario((actual) => (actual === destino ? null : destino));
  };

  const alternarPanelDeCarga = (requirementId: string) => {
    setRequisitoAbierto((actual) => (actual === requirementId ? null : requirementId));
  };

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

  const clearProjectImportFeedback = () => {
    setImportError("");
    setImportSuccess("");
    setImportDetails([]);
  };

  const handleProjectImportFileChange = (file: File | null) => {
    setImportingFile(file);
    clearProjectImportFeedback();
  };

  const handleProjectImportModeChange = (mode: ImportMode) => {
    setImportMode(mode);
    clearProjectImportFeedback();
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
  // El buscador queda fuera del panel de filtros; el boton solo cuenta lo que hay dentro.
  const filtrosActivos = activeFilterCount - (searchTerm.trim() ? 1 : 0);

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

  // Se busca en `requirements`, no en la lista filtrada: un filtro no debe cerrar
  // el panel de un requisito que el usuario tiene abierto.
  const requisitoDelPanel = requisitoAbierto
    ? requirements.find((r) => r.id === requisitoAbierto)
    : undefined;
  const panelDeCarga = requisitoDelPanel ? (
    <RequirementEvidencePanel
      key={requisitoDelPanel.id}
      projectId={projectId}
      requirement={{
        id: requisitoDelPanel.id,
        item: getDisplayValue(requisitoDelPanel.item, "Sin item"),
        titulo: requisitoDelPanel.titulo || requisitoDelPanel.name,
        criterioAceptacion: requisitoDelPanel.criterioAceptacion ?? null,
      }}
      documentos={(requisitoDelPanel.evidenceLinks ?? []).map((v) => ({
        id: v.id,
        title: v.evidenceItem.title,
        linkType: v.linkType,
      }))}
      onClose={() => setRequisitoAbierto(null)}
      onUploaded={() => reloadRequirements()}
    />
  ) : null;

  return (
    <main style={{ ...pageStyle, ...(isMobile ? mobilePageStyle : {}) }}>
      <DestructiveConfirmationDialog
        confirmation={confirmation}
        onCancel={() => setConfirmation(null)}
      />

      <header style={{ marginBottom: 16 }}>
        <Link href="/projects" style={breadcrumbLinkStyle}>
          Proyectos
        </Link>
        {editingProjectMeta ? (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #dbe5f1",
              borderRadius: 8,
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
                  aria-disabled={savingProjectMeta}
                  style={secondaryButtonStyle}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveProjectMeta}
                  disabled={savingProjectMeta}
                  aria-disabled={savingProjectMeta}
                  style={primaryButtonStyle}
                >
                  {savingProjectMeta ? "Guardando..." : "Guardar proyecto"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              alignItems: "flex-start",
              display: isMobile ? "grid" : "flex",
              gap: 14,
              justifyContent: "space-between",
              marginTop: 4,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h1 style={projectTitleStyle}>
                {projectMeta?.name || "Gestion de requerimientos"}
              </h1>
              <div style={projectMetaRowStyle}>
                <span
                  style={{
                    ...projectRoleBadgeBaseStyle,
                    ...getProjectRoleBadgeStyle(projectMeta?.role),
                  }}
                >
                  {getProjectRoleLabel(projectMeta?.role)}
                </span>
                {projectMeta?.code ? (
                  <span style={projectCodeBadgeStyle}>{projectMeta.code}</span>
                ) : null}
              </div>
            </div>
            <div style={{ display: "flex", flexShrink: 0, flexWrap: "wrap", gap: 8 }}>
              <button
                type="button"
                onClick={startProjectMetaEditing}
                style={linkButtonStyle}
              >
                Editar
              </button>
              <Link href={`/projects/${projectId}/matrix`} style={linkButtonStyle}>
                Matriz de cumplimiento
              </Link>
              <Link
                href={`/dashboard?projectId=${encodeURIComponent(projectId)}`}
                style={linkButtonStyle}
              >
                Dashboard
              </Link>
            </div>
          </div>
        )}
        {metaError ? (
          <p style={{ color: "#b91c1c", margin: "8px 0 0" }}>{metaError}</p>
        ) : null}
      </header>

      <dl
        style={{
          ...metricStripStyle,
          gridTemplateColumns: isMobile
            ? "repeat(2, minmax(0, 1fr))"
            : "repeat(4, minmax(0, 1fr))",
        }}
      >
        <MetricCard label="Requerimientos" value={summary.total} />
        <MetricCard label="Cumplimiento" value={`${summary.percent}%`} />
        <MetricCard label="Próximos 7 días" value={summary.upcoming} tone="warning" />
        <MetricCard label="Vencidos" value={summary.overdue} tone="risk" />
      </dl>

      <div
        role="tablist"
        aria-label="Vistas del proyecto"
        onKeyDown={alTeclearVista}
        style={viewTabListStyle}
      >
        {VISTAS.map((v) => {
          const activa = v === vista;
          const recuento =
            v === "requerimientos" ? summary.total : totalPlantillas;
          return (
            <button
              key={v}
              ref={(el) => {
                pestanasVista.current[v] = el;
              }}
              type="button"
              role="tab"
              id={`vista-pestana-${v}`}
              aria-selected={activa}
              aria-controls={`vista-panel-${v}`}
              tabIndex={activa ? 0 : -1}
              onClick={() => cambiarVista(v)}
              style={{ ...viewTabStyle, ...(activa ? viewTabActiveStyle : {}) }}
            >
              {VISTA_ETIQUETA[v]}
              {recuento !== null ? (
                <span
                  style={{
                    ...viewTabCountStyle,
                    ...(activa ? viewTabCountActiveStyle : {}),
                  }}
                >
                  {recuento}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="vista-panel-requerimientos"
        aria-labelledby="vista-pestana-requerimientos"
        hidden={vista !== "requerimientos"}
      >
        {(actionError || actionSuccess) && (
          <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
            {actionError ? (
              <Notice tone="error" message={actionError} compact />
            ) : null}
            {actionSuccess ? (
              <Notice tone="success" message={actionSuccess} compact />
            ) : null}
          </div>
        )}

        <div style={toolbarStyle}>
          <input
            type="search"
            aria-label="Buscar requerimientos"
            placeholder="Buscar por norma, item, descripción o evidencia"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            style={{
              ...controlStyle,
              flex: "1 1 260px",
              maxWidth: isMobile ? undefined : 420,
            }}
          />
          <button
            type="button"
            aria-expanded={filtrosAbiertos}
            aria-controls="filtros-requerimientos"
            onClick={() => setFiltrosAbiertos((abierto) => !abierto)}
            style={{
              ...secondaryButtonStyle,
              ...(filtrosAbiertos ? toggleActiveStyle : {}),
            }}
          >
            {filtrosActivos > 0 ? `Filtros (${filtrosActivos})` : "Filtros"}
          </button>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginLeft: isMobile ? 0 : "auto",
            }}
          >
            <button
              type="button"
              aria-expanded={formulario === "importar"}
              aria-controls="importar-requerimientos"
              onClick={() => alternarFormulario("importar")}
              style={{
                ...secondaryButtonStyle,
                ...(formulario === "importar" ? toggleActiveStyle : {}),
              }}
            >
              Importar Excel
            </button>
            <button
              type="button"
              aria-expanded={formulario === "nuevo"}
              aria-controls="nuevo-requerimiento"
              onClick={() => alternarFormulario("nuevo")}
              style={primaryButtonStyle}
            >
              Nuevo requerimiento
            </button>
          </div>
        </div>

        {filtrosAbiertos ? (
          <FilterPanel
            normaOptions={normaOptions}
            selectedNorma={selectedNorma}
            selectedStatuses={selectedStatuses}
            dateFilter={dateFilter}
            activeFilterCount={activeFilterCount}
            onNormaChange={setSelectedNorma}
            onStatusToggle={toggleStatusFilter}
            onDateFilterChange={setDateFilter}
            onReset={resetFilters}
            compactLayout={isMobile}
            sortMode={sortMode}
            onSortModeChange={setSortMode}
          />
        ) : null}

        {formulario === "nuevo" ? (
          <section
            id="nuevo-requerimiento"
            aria-labelledby="nuevo-requerimiento-titulo"
            style={{ ...panelStyle, marginBottom: 16 }}
          >
            <SectionHeader
              id="nuevo-requerimiento-titulo"
              title="Nuevo requerimiento"
              description="Registra un requisito del proyecto con su estado, evidencia y fecha límite."
              onClose={() => setFormulario(null)}
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
                  : "repeat(2, minmax(0, 1fr))",
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
              aria-disabled={savingNew}
              style={{
                ...primaryButtonStyle,
                ...getActionStateStyle(savingNew),
                marginTop: 14,
              }}
            >
              {savingNew ? "Guardando..." : "Añadir requerimiento"}
            </button>
          </section>
        ) : null}

        {formulario === "importar" ? (
          <section
            id="importar-requerimientos"
            aria-labelledby="importar-requerimientos-titulo"
            style={{ ...panelStyle, marginBottom: 16 }}
          >
            <SectionHeader
              id="importar-requerimientos-titulo"
              title="Importar requisitos del proyecto"
              description="Sube un Excel específico para este proyecto. Puedes añadir solo nuevos requerimientos o reemplazar por completo el listado actual."
              onClose={() => setFormulario(null)}
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
                    handleProjectImportFileChange(event.target.files?.[0] || null)
                  }
                  style={controlStyle}
                />
              </label>

              <label style={filterLabelStyle}>
                Modo de importación
                <select
                  value={importMode}
                  onChange={(event) =>
                    handleProjectImportModeChange(event.target.value as ImportMode)
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
                aria-disabled={importingRequirements}
                style={{
                  ...primaryButtonStyle,
                  ...getActionStateStyle(importingRequirements),
                  gridColumn: isMobile ? undefined : "1 / -1",
                  justifySelf: isMobile ? "stretch" : "end",
                  minWidth: isMobile ? undefined : 180,
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

            {importingRequirements ? (
              <Notice
                tone="info"
                message="Importando requisitos del proyecto. Mantén esta página abierta hasta que termine."
                compact
                style={{ marginTop: 14 }}
              />
            ) : null}

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
        ) : null}

        <div style={listSummaryStyle}>
          <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 10 }}>
            <span style={{ color: "#475569", fontSize: 13 }}>
              {filteredRequirements.length} de {summary.total} requerimientos
            </span>
            {activeFilterCount > 0 ? (
              <button type="button" onClick={resetFilters} style={textButtonStyle}>
                Quitar filtros
              </button>
            ) : null}
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
                  aria-disabled={generatingBaseRequirements}
                  style={{
                    ...primaryButtonStyle,
                    ...getActionStateStyle(generatingBaseRequirements),
                    marginTop: 14,
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

        {!loading && !loadError && filteredRequirements.length > 0 ? (
          isMobile ? (
            <div style={{ display: "grid", gap: 12 }}>
              {filteredRequirements.map((requirement) => (
                <Fragment key={requirement.id}>
                  <RequirementCard
                    requirement={requirement}
                    editing={editingId === requirement.id}
                    editData={editData}
                    savingEdit={savingEdit}
                    deletingRequirement={deletingRequirementId === requirement.id}
                    evidencePanelOpen={requisitoAbierto === requirement.id}
                    onToggleEvidencePanel={() => alternarPanelDeCarga(requirement.id)}
                    onStartEditing={startEditing}
                    onCancelEditing={cancelEditing}
                    onSaveEditing={saveEditing}
                    onEditChange={setEditData}
                    onDeleteRequirement={deleteRequirement}
                  />
                  {/* En movil el panel va bajo su tarjeta: al final de la lista quedaria lejos. */}
                  {requisitoAbierto === requirement.id ? panelDeCarga : null}
                </Fragment>
              ))}
            </div>
          ) : (
            <div style={tableWrapStyle}>
              <table style={tableStyle} aria-label="Requerimientos del proyecto">
                <colgroup>
                  <col style={{ width: 128 }} />
                  <col />
                  <col style={{ width: 132 }} />
                  <col style={{ width: 128 }} />
                  <col style={{ width: 300 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" style={thStyle}>Ref.</th>
                    <th scope="col" style={thStyle}>Requerimiento</th>
                    <th scope="col" style={thStyle}>Estado</th>
                    <th scope="col" style={thStyle}>Fecha límite</th>
                    <th scope="col" style={{ ...thStyle, textAlign: "right" }}>
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequirements.map((requirement) => (
                    <RequirementRow
                      key={requirement.id}
                      requirement={requirement}
                      editing={editingId === requirement.id}
                      editData={editData}
                      savingEdit={savingEdit}
                      deletingRequirement={deletingRequirementId === requirement.id}
                      evidencePanel={
                        requisitoAbierto === requirement.id ? panelDeCarga : null
                      }
                      onToggleEvidencePanel={() => alternarPanelDeCarga(requirement.id)}
                      onStartEditing={startEditing}
                      onCancelEditing={cancelEditing}
                      onSaveEditing={saveEditing}
                      onEditChange={setEditData}
                      onDeleteRequirement={deleteRequirement}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </div>

      <div
        role="tabpanel"
        id="vista-panel-documentacion"
        aria-labelledby="vista-pestana-documentacion"
        hidden={vista !== "documentacion"}
      >
        <ProjectDocumentsSection
          projectId={projectId}
          onTotalChange={setTotalPlantillas}
        />
      </div>
    </main>
  );
}

type RequirementItemProps = {
  requirement: Requirement;
  editing: boolean;
  editData: EditData;
  savingEdit: boolean;
  deletingRequirement: boolean;
  onToggleEvidencePanel: () => void;
  onStartEditing: (requirement: Requirement) => void;
  onCancelEditing: () => void;
  onSaveEditing: () => void;
  onEditChange: (data: EditData) => void;
  onDeleteRequirement: (requirement: Requirement) => void;
};

// Escritorio: una fila de tabla por requisito. La edicion y el panel de documentos
// se abren en una fila de ancho completo debajo, para no estrechar la tabla.
function RequirementRow({
  requirement,
  editing,
  editData,
  savingEdit,
  deletingRequirement,
  evidencePanel,
  onToggleEvidencePanel,
  onStartEditing,
  onCancelEditing,
  onSaveEditing,
  onEditChange,
  onDeleteRequirement,
}: RequirementItemProps & { evidencePanel: ReactNode }) {
  const currentStatus = normalizeStatus(requirement.status);
  const overdue = isRequirementOverdue(requirement);
  const evidencia = requirement.evidencia?.trim();

  if (editing) {
    return (
      <tr>
        <td colSpan={5} style={{ ...tdStyle, background: "#f8fafc", padding: 16 }}>
          <EditRequirementForm
            editData={editData}
            savingEdit={savingEdit}
            onCancelEditing={onCancelEditing}
            onSaveEditing={onSaveEditing}
            onEditChange={onEditChange}
            compactLayout={false}
          />
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr style={{ background: overdue ? "#fff7f7" : undefined }}>
        <td style={{ ...tdStyle, ...refCellStyle }}>
          {getDisplayValue(requirement.norma, "Sin norma")} /{" "}
          {getDisplayValue(requirement.item, "Sin item")}
        </td>
        <td style={tdStyle}>
          <div style={requirementTitleStyle}>
            {getDisplayValue(requirement.name, "Sin descripción")}
          </div>
          {evidencia ? (
            <div style={evidenceLineStyle} title={evidencia}>
              Evidencia: {evidencia}
            </div>
          ) : null}
        </td>
        <td style={tdStyle}>
          <StatusBadge status={currentStatus} compact />
        </td>
        <td style={tdStyle}>
          <DeadlineValue requirement={requirement} />
        </td>
        <td style={{ ...tdStyle, textAlign: "right" }}>
          <RequirementActions
            requirement={requirement}
            deletingRequirement={deletingRequirement}
            evidencePanelOpen={Boolean(evidencePanel)}
            onToggleEvidencePanel={onToggleEvidencePanel}
            onStartEditing={onStartEditing}
            onDeleteRequirement={onDeleteRequirement}
          />
        </td>
      </tr>
      {evidencePanel ? (
        <tr>
          <td colSpan={5} style={{ ...tdStyle, background: "#f8fafc", padding: 12 }}>
            {evidencePanel}
          </td>
        </tr>
      ) : null}
    </>
  );
}

// Movil: la misma informacion en una ficha compacta.
function RequirementCard({
  requirement,
  editing,
  editData,
  savingEdit,
  deletingRequirement,
  evidencePanelOpen,
  onToggleEvidencePanel,
  onStartEditing,
  onCancelEditing,
  onSaveEditing,
  onEditChange,
  onDeleteRequirement,
}: RequirementItemProps & { evidencePanelOpen: boolean }) {
  const currentStatus = normalizeStatus(requirement.status);
  const overdue = isRequirementOverdue(requirement);
  const evidencia = requirement.evidencia?.trim();

  return (
    <article
      style={{
        background: overdue ? "#fff7f7" : "white",
        border: `1px solid ${overdue ? "#fecaca" : "#dbe3f1"}`,
        borderRadius: 8,
        padding: 14,
      }}
    >
      {editing ? (
        <EditRequirementForm
          editData={editData}
          savingEdit={savingEdit}
          onCancelEditing={onCancelEditing}
          onSaveEditing={onSaveEditing}
          onEditChange={onEditChange}
          compactLayout
        />
      ) : (
        <>
          <div
            style={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "space-between",
            }}
          >
            <span style={refCellStyle}>
              {getDisplayValue(requirement.norma, "Sin norma")} /{" "}
              {getDisplayValue(requirement.item, "Sin item")}
            </span>
            <StatusBadge status={currentStatus} compact />
          </div>
          <div style={{ ...requirementTitleStyle, marginTop: 8 }}>
            {getDisplayValue(requirement.name, "Sin descripción")}
          </div>
          {evidencia ? (
            <div style={evidenceLineStyle} title={evidencia}>
              Evidencia: {evidencia}
            </div>
          ) : null}
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
            <DeadlineValue requirement={requirement} inline />
            <RequirementActions
              requirement={requirement}
              compact
              deletingRequirement={deletingRequirement}
              evidencePanelOpen={evidencePanelOpen}
              onToggleEvidencePanel={onToggleEvidencePanel}
              onStartEditing={onStartEditing}
              onDeleteRequirement={onDeleteRequirement}
            />
          </div>
        </>
      )}
    </article>
  );
}

function RequirementActions({
  requirement,
  compact = false,
  deletingRequirement,
  evidencePanelOpen,
  onToggleEvidencePanel,
  onStartEditing,
  onDeleteRequirement,
}: {
  requirement: Requirement;
  compact?: boolean;
  deletingRequirement: boolean;
  evidencePanelOpen: boolean;
  onToggleEvidencePanel: () => void;
  onStartEditing: (requirement: Requirement) => void;
  onDeleteRequirement: (requirement: Requirement) => void;
}) {
  return (
    <div style={{ display: "inline-flex", flexWrap: compact ? "wrap" : "nowrap", gap: 6, justifyContent: "flex-end" }}>
      <button
        type="button"
        onClick={onToggleEvidencePanel}
        aria-expanded={evidencePanelOpen}
        style={{
          ...compactActionButtonStyle,
          ...(evidencePanelOpen ? toggleActiveStyle : {}),
        }}
      >
        Documentos ({requirement.evidenceLinks?.length ?? 0})
      </button>
      <button
        type="button"
        onClick={() => onStartEditing(requirement)}
        disabled={deletingRequirement}
        aria-disabled={deletingRequirement}
        style={{
          ...compactActionButtonStyle,
          ...getActionStateStyle(deletingRequirement),
        }}
      >
        Editar
      </button>
      <button
        type="button"
        onClick={() => onDeleteRequirement(requirement)}
        disabled={deletingRequirement}
        aria-disabled={deletingRequirement}
        style={{
          ...compactDangerButtonStyle,
          ...getActionStateStyle(deletingRequirement),
        }}
      >
        {deletingRequirement ? "Eliminando..." : "Eliminar"}
      </button>
    </div>
  );
}

// Fecha y seguimiento en un solo dato: "Vencido" o "Proximo" encima de la fecha.
function DeadlineValue({
  requirement,
  inline = false,
}: {
  requirement: Requirement;
  inline?: boolean;
}) {
  const overdue = isRequirementOverdue(requirement);
  const upcoming = isRequirementUpcoming(requirement);
  const fecha = formatDate(requirement.deadline);

  if (!requirement.deadline) {
    return <span style={{ color: "#64748b", fontSize: 13 }}>Sin fecha</span>;
  }

  const aviso = overdue ? "Vencido" : upcoming ? "Próximo" : null;
  const color = overdue ? "#b91c1c" : upcoming ? "#b45309" : "#1f2937";

  return (
    <span
      style={{
        color,
        display: inline ? "inline-flex" : "grid",
        fontSize: 13,
        gap: inline ? 6 : 2,
      }}
    >
      {aviso ? <strong style={{ fontWeight: 600 }}>{aviso}</strong> : null}
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{fecha}</span>
    </span>
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
          borderRadius: 8,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "space-between",
          marginBottom: 16,
          padding: "12px 14px",
        }}
      >
        <div>
          <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>
            Modo edición
          </div>
          <div style={{ color: "#0f172a", fontSize: 14, fontWeight: 500, marginTop: 4 }}>
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
              fontWeight: 600,
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
            : "repeat(2, minmax(0, 1fr))",
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
          aria-disabled={savingEdit}
          style={secondaryButtonStyle}
        >
          Cancelar
        </button>
        <button
          onClick={onSaveEditing}
          disabled={savingEdit}
          aria-disabled={savingEdit}
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
  onNormaChange,
  onStatusToggle,
  onDateFilterChange,
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
  onNormaChange: (value: string) => void;
  onStatusToggle: (status: RequirementStatus) => void;
  onDateFilterChange: (value: DateFilter) => void;
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
        border: "1px solid #dbe3f1",
        borderRadius: 8,
        boxShadow: "none",
        marginBottom: 16,
        padding: 16,
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <h3 style={listTitleStyle}>Filtros y ordenación</h3>

        <button
          type="button"
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
          alignItems: "start",
          display: "grid",
          gap: 14,
          gridTemplateColumns: compactLayout
            ? "minmax(0, 1fr)"
            : "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
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
                    fontWeight: 600,
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
  id,
  title,
  description,
  onClose,
}: {
  id: string;
  title: string;
  description: string;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        alignItems: "flex-start",
        display: "flex",
        gap: 12,
        justifyContent: "space-between",
        marginBottom: 16,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h3 id={id} style={{ ...listTitleStyle, marginBottom: 6 }}>
          {title}
        </h3>
        <p style={{ color: "#5b6b82", lineHeight: 1.5, margin: 0, maxWidth: "70ch" }}>
          {description}
        </p>
      </div>
      <button type="button" onClick={onClose} style={secondaryButtonStyle}>
        Cerrar
      </button>
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
    <div style={{ background: "white", minWidth: 0, padding: "10px 16px" }}>
      <dt style={{ color: "#5b6b82", fontSize: 12 }}>{label}</dt>
      <dd
        style={{
          color:
            tone === "risk"
              ? "#dc2626"
              : tone === "warning"
                ? "#b45309"
                : "#111827",
          fontSize: 20,
          fontVariantNumeric: "tabular-nums",
          fontWeight: 600,
          margin: "2px 0 0",
        }}
      >
        {value}
      </dd>
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
        ...appBadgeBaseStyle,
        background: meta.background,
        border: `1px solid ${meta.border}`,
        color: meta.color,
        fontSize: compact ? 11 : 12,
        padding: compact ? "4px 8px" : "5px 10px",
      }}
    >
      {label || meta.label}
    </span>
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
  fontWeight: 600,
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
  alignItems: "center",
  display: "inline-flex",
  fontSize: 14,
  justifyContent: "center",
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
  ...appBadgeBaseStyle,
};

const projectCodeBadgeStyle: React.CSSProperties = {
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: 999,
  color: "#1e3a8a",
  display: "inline-flex",
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 0,
  padding: "6px 11px",
  textTransform: "uppercase",
};

const inlineFieldStyle: React.CSSProperties = {
  color: "#334155",
  display: "grid",
  fontSize: 12,
  fontWeight: 600,
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
  padding: 18,
};

const listTitleStyle: React.CSSProperties = {
  color: "#002a4e",
  fontSize: 18,
  fontWeight: 500,
  margin: 0,
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
  fontWeight: 600,
  minHeight: 32,
  padding: "5px 10px",
  whiteSpace: "nowrap",
};

const compactDangerButtonStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #fecaca",
  borderRadius: 8,
  color: "#b91c1c",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  minHeight: 32,
  padding: "5px 10px",
  whiteSpace: "nowrap",
};

const breadcrumbLinkStyle: React.CSSProperties = {
  color: "#1d4ed8",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
};

const projectTitleStyle: React.CSSProperties = {
  color: "#002a4e",
  fontSize: 26,
  fontWeight: 500,
  lineHeight: 1.2,
  margin: 0,
  overflowWrap: "anywhere",
  textWrap: "balance",
};

const projectMetaRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 8,
};

// Una franja con divisiones de 1px: el fondo asoma por el hueco de la rejilla.
const metricStripStyle: React.CSSProperties = {
  background: "#dbe3f1",
  border: "1px solid #dbe3f1",
  borderRadius: 8,
  display: "grid",
  gap: 1,
  margin: "0 0 18px",
  overflow: "hidden",
};

const viewTabListStyle: React.CSSProperties = {
  borderBottom: "1px solid #dbe3f1",
  display: "flex",
  gap: 4,
  marginBottom: 18,
  overflowX: "auto",
  overflowY: "hidden",
};

const viewTabStyle: React.CSSProperties = {
  alignItems: "center",
  background: "transparent",
  // Sin mezclar abreviadas y largas: React avisa al cambiar de pestana.
  borderColor: "transparent",
  borderStyle: "solid",
  borderWidth: "0 0 3px",
  color: "#334155",
  cursor: "pointer",
  display: "inline-flex",
  flexShrink: 0,
  fontSize: 15,
  fontWeight: 500,
  gap: 8,
  marginBottom: -1,
  minHeight: 46,
  padding: "8px 16px",
  whiteSpace: "nowrap",
};

const viewTabActiveStyle: React.CSSProperties = {
  borderColor: "transparent transparent #0025df",
  color: "#0025df",
  fontWeight: 600,
};

const viewTabCountStyle: React.CSSProperties = {
  background: "#eef2f7",
  borderRadius: 999,
  color: "#334155",
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 600,
  minWidth: 22,
  padding: "1px 8px",
  textAlign: "center",
};

const viewTabCountActiveStyle: React.CSSProperties = {
  background: "#eef1ff",
  color: "#0025df",
};

const toolbarStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginBottom: 14,
};

const toggleActiveStyle: React.CSSProperties = {
  background: "#eef1ff",
  border: "1px solid #9fb0f5",
  color: "#0025df",
};

const textButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#1d4ed8",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  padding: 0,
  textDecoration: "underline",
};

const listSummaryStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  justifyContent: "space-between",
  marginBottom: 10,
};

const tableWrapStyle: React.CSSProperties = {
  ...appPanelStyle,
  overflowX: "auto",
};

const tableStyle: React.CSSProperties = {
  borderCollapse: "collapse",
  minWidth: 860,
  tableLayout: "fixed",
  width: "100%",
};

const thStyle: React.CSSProperties = {
  background: "#f8fafc",
  borderBottom: "1px solid #dbe3f1",
  color: "#475569",
  fontSize: 12,
  fontWeight: 600,
  padding: "9px 12px",
  textAlign: "left",
};

const tdStyle: React.CSSProperties = {
  borderTop: "1px solid #e8edf5",
  padding: "10px 12px",
  verticalAlign: "middle",
};

const refCellStyle: React.CSSProperties = {
  color: "#475569",
  fontSize: 13,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 600,
};

const requirementTitleStyle: React.CSSProperties = {
  color: "#111827",
  fontSize: 14,
  lineHeight: 1.4,
};

const evidenceLineStyle: React.CSSProperties = {
  color: "#5b6b82",
  fontSize: 12,
  marginTop: 3,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
