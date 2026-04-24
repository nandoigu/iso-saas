"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  compareRequirementsNaturally,
  EMPTY_EDIT_DATA,
  formatDate,
  getDeadlineTime,
  getDisplayValue,
  isRequirementOverdue,
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

export default function ProjectClient({ projectId }: ProjectClientProps) {
  const { requirements, loading, loadError, reloadRequirements } =
    useProjectRequirements(projectId);

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

      await reloadRequirements();
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
      await reloadRequirements();
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

  return (
    <main style={{ padding: 40 }}>
      <header
        style={{
          alignItems: "flex-start",
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          justifyContent: "space-between",
          marginBottom: 28,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Gestion de requerimientos</h2>
          <p style={{ color: "#6b7280", margin: "8px 0 0" }}>
            Alta, edicion y seguimiento de requerimientos, evidencias, estados y
            fechas limite del proyecto.
          </p>
        </div>

        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <label style={{ color: "#4b5563", fontSize: 13 }}>Ordenar por</label>
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

          <Link href={`/projects/${projectId}/matrix`} style={linkButtonStyle}>
            Ver matriz de cumplimiento
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
        <MetricCard label="Vencidos" value={summary.overdue} tone="risk" />
      </section>

      <section
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
          marginBottom: 24,
          padding: 20,
        }}
      >
        <h3 style={{ margin: "0 0 16px" }}>Nuevo requerimiento</h3>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          <input
            placeholder="Norma"
            value={norma}
            onChange={(event) => setNorma(event.target.value)}
            style={controlStyle}
          />

          <input
            placeholder="Item"
            value={item}
            onChange={(event) => setItem(event.target.value)}
            style={controlStyle}
          />

          <input
            placeholder="Descripcion del requerimiento"
            value={name}
            onChange={(event) => setName(event.target.value)}
            style={controlStyle}
          />

          <input
            placeholder="Evidencia"
            value={evidencia}
            onChange={(event) => setEvidencia(event.target.value)}
            style={controlStyle}
          />

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

          <input
            type="date"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
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
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <h3 style={{ margin: 0 }}>Requerimientos</h3>
          <span style={{ color: "#6b7280", fontSize: 13 }}>
            {filteredRequirements.length} de {summary.total} registros
          </span>
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
        borderLeft: `5px solid ${
          overdue ? "#dc2626" : STATUS_META[currentStatus].color
        }`,
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
              alignItems: "flex-start",
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              justifyContent: "space-between",
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

            <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
              {overdue && <OverdueBadge />}
              <StatusBadge status={currentStatus} />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <input
          value={editData.norma}
          onChange={(event) =>
            onEditChange({ ...editData, norma: event.target.value })
          }
          placeholder="Norma"
          style={controlStyle}
        />

        <input
          value={editData.item}
          onChange={(event) =>
            onEditChange({ ...editData, item: event.target.value })
          }
          placeholder="Item"
          style={controlStyle}
        />

        <input
          value={editData.name}
          onChange={(event) =>
            onEditChange({ ...editData, name: event.target.value })
          }
          placeholder="Descripcion"
          style={controlStyle}
        />

        <input
          value={editData.evidencia}
          onChange={(event) =>
            onEditChange({ ...editData, evidencia: event.target.value })
          }
          placeholder="Evidencia"
          style={controlStyle}
        />

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

        <input
          type="date"
          value={editData.deadline}
          onChange={(event) =>
            onEditChange({ ...editData, deadline: event.target.value })
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
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>Filtros</h3>
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
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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
            onChange={(event) =>
              onDateFilterChange(event.target.value as DateFilter)
            }
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

const linkButtonStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  color: "#111827",
  display: "inline-flex",
  fontWeight: 700,
  minHeight: 40,
  padding: "9px 14px",
  textDecoration: "none",
};
