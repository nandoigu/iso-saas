"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type RequirementStatus = "total" | "parcial" | "no_conforme";
type SortMode = "natural" | "deadline" | "status" | "created";
type DateFilter = "all" | "overdue" | "upcoming" | "no_date";

type Requirement = {
  id: string;
  norma?: string | null;
  item?: string | null;
  name: string;
  evidencia?: string | null;
  status?: RequirementStatus | null;
  deadline?: string | null;
};

type EditData = {
  id: string;
  norma: string;
  item: string;
  name: string;
  evidencia: string;
  status: RequirementStatus;
  deadline: string;
};

type ProjectClientProps = {
  projectId: string;
};

const STATUS_META: Record<
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

const EMPTY_EDIT_DATA: EditData = {
  id: "",
  norma: "",
  item: "",
  name: "",
  evidencia: "",
  status: "no_conforme",
  deadline: "",
};

export default function ProjectClient({ projectId }: ProjectClientProps) {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("natural");
  const [selectedNorma, setSelectedNorma] = useState("all");
  const [selectedStatuses, setSelectedStatuses] = useState<RequirementStatus[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const [norma, setNorma] = useState("");
  const [item, setItem] = useState("");
  const [name, setName] = useState("");
  const [evidencia, setEvidencia] = useState("");
  const [status, setStatus] = useState<RequirementStatus>("no_conforme");
  const [deadline, setDeadline] = useState("");
  const [savingNew, setSavingNew] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<EditData>(EMPTY_EDIT_DATA);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadRequirements = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    setLoadError("");

    try {
      const res = await fetch(`/api/requirements?projectId=${projectId}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error cargando requirements");
      }

      setRequirements(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error("Error cargando requirements:", error);
      setRequirements([]);
      setLoadError("No se pudieron cargar los requerimientos del proyecto.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadRequirements();
  }, [loadRequirements]);

  const createRequirement = async () => {
    if (!projectId) {
      alert("No se ha detectado el proyecto.");
      return;
    }

    if (!name.trim()) {
      alert("El requerimiento es obligatorio.");
      return;
    }

    setSavingNew(true);

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
        alert(data.error || "Error creando requisito");
        return;
      }

      setNorma("");
      setItem("");
      setName("");
      setEvidencia("");
      setStatus("no_conforme");
      setDeadline("");

      await loadRequirements();
    } catch (error) {
      console.error("ERROR FRONT CREATE:", error);
      alert("Error inesperado creando requisito");
    } finally {
      setSavingNew(false);
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

  const saveEditing = async () => {
    if (!editData.id) {
      alert("No se ha seleccionado un requisito para editar.");
      return;
    }

    if (!editData.name.trim()) {
      alert("El requerimiento es obligatorio.");
      return;
    }

    setSavingEdit(true);

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
        alert(data.error || "Error actualizando");
        return;
      }

      cancelEditing();
      await loadRequirements();
    } catch (error) {
      console.error("ERROR FRONT EDIT:", error);
      alert("Error inesperado actualizando");
    } finally {
      setSavingEdit(false);
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

    return {
      total,
      overdue,
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
      const norma = getDisplayValue(requirement.norma, "Sin norma");

      if (selectedNorma !== "all" && norma !== selectedNorma) {
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

      return true;
    });

    return filtered.sort((a, b) => {
      if (sortMode === "natural") {
        return compareRequirementsNaturally(a, b);
      }

      if (sortMode === "status") {
        return (
          STATUS_META[normalizeStatus(a.status)].order -
          STATUS_META[normalizeStatus(b.status)].order
        ) || compareRequirementsNaturally(a, b);
      }

      if (sortMode === "deadline") {
        const aTime = getDeadlineTime(a.deadline);
        const bTime = getDeadlineTime(b.deadline);
        return (aTime - bTime) || compareRequirementsNaturally(a, b);
      }

      return 0;
    });
  }, [requirements, selectedNorma, selectedStatuses, dateFilter, sortMode]);

  const activeFilterCount =
    (selectedNorma !== "all" ? 1 : 0) +
    selectedStatuses.length +
    (dateFilter !== "all" ? 1 : 0);

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
  };

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
    );
  }, [filteredRequirements]);

  return (
    <main style={{ padding: 40 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 20,
          alignItems: "flex-start",
          marginBottom: 28,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Gestion de Cumplimiento</h2>
          <p style={{ color: "#6b7280", margin: "8px 0 0" }}>
            Requerimientos, evidencias, estados y fechas limite del proyecto.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label style={{ color: "#4b5563", fontSize: 13 }}>
            Ordenar por
          </label>
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            style={controlStyle}
          >
            <option value="natural">Norma e item</option>
            <option value="deadline">Fecha limite</option>
            <option value="status">Estado</option>
            <option value="created">Orden original</option>
          </select>
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
        <MetricCard label="Vencidos" value={summary.overdue} tone="risk" />
      </section>

      <section
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
          boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
        }}
      >
        <h3 style={{ margin: "0 0 16px" }}>Nuevo requerimiento</h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <input
            placeholder="Norma"
            value={norma}
            onChange={(e) => setNorma(e.target.value)}
            style={controlStyle}
          />

          <input
            placeholder="Item"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            style={controlStyle}
          />

          <input
            placeholder="Descripcion del requerimiento"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={controlStyle}
          />

          <input
            placeholder="Evidencia"
            value={evidencia}
            onChange={(e) => setEvidencia(e.target.value)}
            style={controlStyle}
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as RequirementStatus)}
            style={controlStyle}
          >
            <option value="total">Total</option>
            <option value="parcial">Parcial</option>
            <option value="no_conforme">No conforme</option>
          </select>

          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            style={controlStyle}
          />
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
          {savingNew ? "Guardando..." : "Anadir requerimiento"}
        </button>
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
          onNormaChange={setSelectedNorma}
          onStatusToggle={toggleStatusFilter}
          onDateFilterChange={setDateFilter}
          onReset={resetFilters}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "center",
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ margin: 0 }}>Requerimientos</h3>
          <span style={{ color: "#6b7280", fontSize: 13 }}>
            {filteredRequirements.length} de {summary.total} registros
          </span>
        </div>

        {loading && <EmptyState title="Cargando" description="Obteniendo requerimientos del proyecto." />}

        {!loading && loadError && (
          <EmptyState title="Error de carga" description={loadError} tone="risk" />
        )}

        {!loading && !loadError && filteredRequirements.length === 0 && (
          <EmptyState
            title={requirements.length === 0 ? "Sin requerimientos" : "Sin resultados"}
            description={
              requirements.length === 0
                ? "Anade el primer requerimiento para comenzar a medir cumplimiento."
                : "No hay requerimientos que coincidan con los filtros activos."
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
                onStartEditing={startEditing}
                onCancelEditing={cancelEditing}
                onSaveEditing={saveEditing}
                onEditChange={setEditData}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 style={{ marginTop: 40 }}>Matriz de Cumplimiento</h3>

        {matrixData.length === 0 && (
          <EmptyState
            title="Sin matriz"
            description="No hay requerimientos suficientes para agrupar por norma e item."
          />
        )}

        {matrixData.map(([normaKey, items]) => (
          <div
            key={normaKey}
            style={{
              background: "white",
              border: "1px solid #e5e7eb",
              padding: 18,
              borderRadius: 12,
              marginBottom: 16,
            }}
          >
            <h4 style={{ margin: "0 0 12px" }}>{normaKey}</h4>

            {Object.entries(items).map(([itemKey, reqs]) => {
              const matrixPercent = getCompletionPercent(reqs);
              const matrixStatus = getMatrixStatus(matrixPercent);

              return (
                <div
                  key={itemKey}
                  style={{
                    marginTop: 10,
                    padding: 14,
                    border: "1px solid #eef2f7",
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <strong>{itemKey}</strong>
                    <StatusBadge status={matrixStatus} label={`${matrixPercent}%`} />
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {reqs.map((req) => {
                      const currentStatus = normalizeStatus(req.status);

                      return (
                        <div
                          key={req.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 1fr) auto",
                            gap: 12,
                            alignItems: "center",
                            borderTop: "1px solid #f3f4f6",
                            paddingTop: 8,
                          }}
                        >
                          <span style={{ color: "#374151", fontSize: 13 }}>
                            {getDisplayValue(req.name, "Sin descripcion")}
                          </span>
                          <StatusBadge status={currentStatus} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </section>
    </main>
  );
}

function RequirementCard({
  requirement,
  editing,
  editData,
  savingEdit,
  onStartEditing,
  onCancelEditing,
  onSaveEditing,
  onEditChange,
}: {
  requirement: Requirement;
  editing: boolean;
  editData: EditData;
  savingEdit: boolean;
  onStartEditing: (requirement: Requirement) => void;
  onCancelEditing: () => void;
  onSaveEditing: () => void;
  onEditChange: (data: EditData) => void;
}) {
  const currentStatus = normalizeStatus(requirement.status);
  const overdue = isRequirementOverdue(requirement);

  return (
    <article
      style={{
        background: "white",
        border: `1px solid ${overdue ? "#fecaca" : "#e5e7eb"}`,
        borderLeft: `5px solid ${overdue ? "#dc2626" : STATUS_META[currentStatus].color}`,
        borderRadius: 12,
        boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
        padding: 18,
      }}
    >
      {editing ? (
        <EditRequirementForm
          editData={editData}
          savingEdit={savingEdit}
          onCancelEditing={onCancelEditing}
          onSaveEditing={onSaveEditing}
          onEditChange={onEditChange}
        />
      ) : (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 14,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {getDisplayValue(requirement.norma, "Sin norma")} /{" "}
                {getDisplayValue(requirement.item, "Sin item")}
              </div>

              <h4 style={{ fontSize: 17, margin: "8px 0 0" }}>
                {getDisplayValue(requirement.name, "Sin descripcion")}
              </h4>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {overdue && <OverdueBadge />}
              <StatusBadge status={currentStatus} />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginTop: 16,
            }}
          >
            <InfoBlock
              label="Evidencia"
              value={getDisplayValue(requirement.evidencia, "Sin evidencia")}
            />
            <InfoBlock
              label="Fecha limite"
              value={formatDate(requirement.deadline)}
              tone={overdue ? "risk" : "default"}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button
              onClick={() => onStartEditing(requirement)}
              style={secondaryButtonStyle}
            >
              Editar
            </button>
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
}: {
  editData: EditData;
  savingEdit: boolean;
  onCancelEditing: () => void;
  onSaveEditing: () => void;
  onEditChange: (data: EditData) => void;
}) {
  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <input
          value={editData.norma}
          onChange={(e) => onEditChange({ ...editData, norma: e.target.value })}
          placeholder="Norma"
          style={controlStyle}
        />

        <input
          value={editData.item}
          onChange={(e) => onEditChange({ ...editData, item: e.target.value })}
          placeholder="Item"
          style={controlStyle}
        />

        <input
          value={editData.name}
          onChange={(e) => onEditChange({ ...editData, name: e.target.value })}
          placeholder="Descripcion"
          style={controlStyle}
        />

        <input
          value={editData.evidencia}
          onChange={(e) =>
            onEditChange({ ...editData, evidencia: e.target.value })
          }
          placeholder="Evidencia"
          style={controlStyle}
        />

        <select
          value={editData.status}
          onChange={(e) =>
            onEditChange({
              ...editData,
              status: e.target.value as RequirementStatus,
            })
          }
          style={controlStyle}
        >
          <option value="total">Total</option>
          <option value="parcial">Parcial</option>
          <option value="no_conforme">No conforme</option>
        </select>

        <input
          type="date"
          value={editData.deadline}
          onChange={(e) =>
            onEditChange({ ...editData, deadline: e.target.value })
          }
          style={controlStyle}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          justifyContent: "flex-end",
          marginTop: 14,
        }}
      >
        <button onClick={onCancelEditing} disabled={savingEdit} style={secondaryButtonStyle}>
          Cancelar
        </button>
        <button onClick={onSaveEditing} disabled={savingEdit} style={primaryButtonStyle}>
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
  onNormaChange,
  onStatusToggle,
  onDateFilterChange,
  onReset,
}: {
  normaOptions: string[];
  selectedNorma: string;
  selectedStatuses: RequirementStatus[];
  dateFilter: DateFilter;
  activeFilterCount: number;
  totalCount: number;
  filteredCount: number;
  onNormaChange: (value: string) => void;
  onStatusToggle: (status: RequirementStatus) => void;
  onDateFilterChange: (value: DateFilter) => void;
  onReset: () => void;
}) {
  return (
    <section
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
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>Filtros</h3>
          <p style={{ color: "#6b7280", fontSize: 13, margin: "6px 0 0" }}>
            {filteredCount} de {totalCount} requerimientos visibles
            {activeFilterCount > 0 ? ` · ${activeFilterCount} filtros activos` : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={onReset}
          disabled={activeFilterCount === 0}
          style={{
            ...secondaryButtonStyle,
            opacity: activeFilterCount === 0 ? 0.5 : 1,
            cursor: activeFilterCount === 0 ? "not-allowed" : "pointer",
          }}
        >
          Limpiar filtros
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          alignItems: "start",
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
            onChange={(event) => onDateFilterChange(event.target.value as DateFilter)}
            style={controlStyle}
          >
            <option value="all">Todas las fechas</option>
            <option value="overdue">Vencidos</option>
            <option value="upcoming">Proximos 7 dias</option>
            <option value="no_date">Sin fecha</option>
          </select>
        </label>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "risk";
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
          color: tone === "risk" ? "#dc2626" : "#111827",
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
}: {
  label: string;
  value: string;
  tone?: "default" | "risk";
}) {
  return (
    <div
      style={{
        background: "#f9fafb",
        borderRadius: 10,
        padding: 12,
      }}
    >
      <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 4 }}>
        {label}
      </div>
      <div
        style={{
          color: tone === "risk" ? "#b91c1c" : "#111827",
          fontSize: 14,
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

function OverdueBadge() {
  return (
    <span
      style={{
        background: "#fee2e2",
        border: "1px solid #fca5a5",
        borderRadius: 999,
        color: "#991b1b",
        display: "inline-flex",
        fontSize: 12,
        fontWeight: 700,
        padding: "5px 10px",
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
  tone = "default",
}: {
  title: string;
  description: string;
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
    </div>
  );
}

function normalizeStatus(status?: RequirementStatus | string | null): RequirementStatus {
  if (status === "total" || status === "parcial" || status === "no_conforme") {
    return status;
  }

  return "no_conforme";
}

function getDisplayValue(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function formatDate(value?: string | null) {
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

function getDeadlineTime(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getTime();
}

function matchesDateFilter(requirement: Requirement, dateFilter: DateFilter) {
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
    return deadlineDate >= today && deadlineDate <= upcomingLimit;
  }

  return false;
}

function isRequirementOverdue(requirement: Requirement) {
  if (!requirement.deadline || normalizeStatus(requirement.status) === "total") {
    return false;
  }

  const deadlineDate = new Date(requirement.deadline);
  if (Number.isNaN(deadlineDate.getTime())) return false;

  return deadlineDate < startOfToday();
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
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

const naturalCollator = new Intl.Collator("es", {
  numeric: true,
  sensitivity: "base",
});

function naturalTextCompare(a: string, b: string) {
  return naturalCollator.compare(a, b);
}

function compareRequirementsNaturally(a: Requirement, b: Requirement) {
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
      getDisplayValue(a.name, "Sin descripcion"),
      getDisplayValue(b.name, "Sin descripcion")
    )
  );
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

const primaryButtonStyle: React.CSSProperties = {
  background: "#2563eb",
  border: "1px solid #2563eb",
  borderRadius: 8,
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
  minHeight: 40,
  padding: "9px 14px",
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
