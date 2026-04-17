"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type RequirementStatus = "total" | "parcial" | "no_conforme";

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

export default function ProjectClient() {
  const params = useParams();
  const projectId = params?.id as string;

  const [requirements, setRequirements] = useState<Requirement[]>([]);

  const [norma, setNorma] = useState("");
  const [item, setItem] = useState("");
  const [name, setName] = useState("");
  const [evidencia, setEvidencia] = useState("");
  const [status, setStatus] = useState<RequirementStatus>("no_conforme");
  const [deadline, setDeadline] = useState("");
  const [savingNew, setSavingNew] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<EditData>({
    id: "",
    norma: "",
    item: "",
    name: "",
    evidencia: "",
    status: "no_conforme",
    deadline: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const loadRequirements = async () => {
    if (!projectId) return;

    const res = await fetch(`/api/requirements?projectId=${projectId}`, {
      cache: "no-store",
    });
    const data = await res.json();
    setRequirements(data.data || []);
  };

  useEffect(() => {
    loadRequirements();
  }, [projectId]);

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

  const startEditing = (r: Requirement) => {
    setEditingId(r.id);
    setEditData({
      id: r.id,
      norma: r.norma || "",
      item: r.item || "",
      name: r.name || "",
      evidencia: r.evidencia || "",
      status: (r.status || "no_conforme") as RequirementStatus,
      deadline: r.deadline ? r.deadline.slice(0, 10) : "",
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditData({
      id: "",
      norma: "",
      item: "",
      name: "",
      evidencia: "",
      status: "no_conforme",
      deadline: "",
    });
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

  const total = requirements.length;
  const completed = requirements.filter((r) => r.status === "total").length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const overdue = requirements.filter(
    (r) =>
      r.deadline &&
      new Date(r.deadline) < new Date() &&
      r.status !== "total"
  ).length;

  const matrixData = useMemo(() => {
    return Object.entries(
      requirements.reduce((acc: Record<string, Record<string, Requirement[]>>, r) => {
        const normaKey = r.norma || "Sin norma";
        const itemKey = r.item || "Sin ítem";

        if (!acc[normaKey]) acc[normaKey] = {};
        if (!acc[normaKey][itemKey]) acc[normaKey][itemKey] = [];

        acc[normaKey][itemKey].push(r);
        return acc;
      }, {})
    );
  }, [requirements]);

  const getProgressColor = () => {
    if (percent === 100) return "green";
    if (percent > 50) return "#4caf50";
    if (percent > 20) return "orange";
    return "gray";
  };

  const getStatusColor = (st: RequirementStatus) => {
    if (st === "total") return "green";
    if (st === "parcial") return "orange";
    return "red";
  };

  const getMatrixLabel = (value: number) => {
    if (value === 100) return "✅ Completo";
    if (value > 50) return "🟢 Avanzado";
    if (value > 0) return "🟡 Parcial";
    return "🔴 No conforme";
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>Gestión de Cumplimiento</h2>

      <div
        style={{
          marginBottom: 20,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <input
          placeholder="Norma"
          value={norma}
          onChange={(e) => setNorma(e.target.value)}
        />

        <input
          placeholder="Ítem"
          value={item}
          onChange={(e) => setItem(e.target.value)}
        />

        <input
          placeholder="Requerimiento"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          placeholder="Evidencia"
          value={evidencia}
          onChange={(e) => setEvidencia(e.target.value)}
        />

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as RequirementStatus)}
        >
          <option value="total">Total</option>
          <option value="parcial">Parcial</option>
          <option value="no_conforme">No conforme</option>
        </select>

        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />

        <button onClick={createRequirement} disabled={savingNew}>
          {savingNew ? "Guardando..." : "Añadir"}
        </button>
      </div>

      <p>Cumplimiento: {percent}%</p>

      <div
        style={{
          height: 12,
          background: "#eee",
          borderRadius: 10,
          marginBottom: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: "100%",
            background: getProgressColor(),
            borderRadius: 10,
          }}
        />
      </div>

      {overdue > 0 && (
        <p style={{ color: "red" }}>⚠️ {overdue} requisitos vencidos</p>
      )}

      {requirements.map((r) => {
        const st = (r.status || "no_conforme") as RequirementStatus;

        return (
          <div
            key={r.id}
            style={{
              marginBottom: 15,
              padding: 12,
              border: "1px solid #eee",
              borderRadius: 8,
            }}
          >
            {editingId === r.id ? (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(6, minmax(120px, 1fr))",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <input
                    value={editData.norma}
                    onChange={(e) =>
                      setEditData({ ...editData, norma: e.target.value })
                    }
                    placeholder="Norma"
                  />

                  <input
                    value={editData.item}
                    onChange={(e) =>
                      setEditData({ ...editData, item: e.target.value })
                    }
                    placeholder="Ítem"
                  />

                  <input
                    value={editData.name}
                    onChange={(e) =>
                      setEditData({ ...editData, name: e.target.value })
                    }
                    placeholder="Requerimiento"
                  />

                  <input
                    value={editData.evidencia}
                    onChange={(e) =>
                      setEditData({ ...editData, evidencia: e.target.value })
                    }
                    placeholder="Evidencia"
                  />

                  <select
                    value={editData.status}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        status: e.target.value as RequirementStatus,
                      })
                    }
                  >
                    <option value="total">Total</option>
                    <option value="parcial">Parcial</option>
                    <option value="no_conforme">No conforme</option>
                  </select>

                  <input
                    type="date"
                    value={editData.deadline}
                    onChange={(e) =>
                      setEditData({ ...editData, deadline: e.target.value })
                    }
                  />
                </div>

                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <button onClick={saveEditing} disabled={savingEdit}>
                    💾 {savingEdit ? "Guardando..." : "Guardar"}
                  </button>

                  <button onClick={cancelEditing} disabled={savingEdit}>
                    ❌ Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <strong>
                  {r.norma || "Sin norma"}
                  {r.item ? ` · ${r.item}` : ""}
                </strong>

                <div>{r.name}</div>

                <div style={{ fontSize: 12 }}>
                  📎 {r.evidencia || "Sin evidencia"}
                </div>

                <div style={{ color: getStatusColor(st) }}>📊 {st}</div>

                <div style={{ fontSize: 12 }}>
                  📅{" "}
                  {r.deadline
                    ? new Date(r.deadline).toLocaleDateString()
                    : "Sin fecha"}
                </div>

                <div style={{ marginTop: 8 }}>
                  <button onClick={() => startEditing(r)}>✏️ Editar</button>
                </div>
              </>
            )}
          </div>
        );
      })}

      <h3 style={{ marginTop: 40 }}>📊 Matriz de Cumplimiento</h3>

      {matrixData.map(([normaKey, items]) => (
        <div
          key={normaKey}
          style={{
            border: "1px solid #ddd",
            padding: 15,
            borderRadius: 10,
            marginBottom: 20,
          }}
        >
          <h4>📘 {normaKey}</h4>

          {Object.entries(items).map(([itemKey, reqs]) => {
            const totalReqs = reqs.length;

            const score = reqs.reduce((sum, req) => {
              if (req.status === "total") return sum + 1;
              if (req.status === "parcial") return sum + 0.5;
              return sum;
            }, 0);

            const matrixPercent = totalReqs
              ? Math.round((score / totalReqs) * 100)
              : 0;

            let matrixColor = "red";
            if (matrixPercent === 100) matrixColor = "green";
            else if (matrixPercent > 50) matrixColor = "#4caf50";
            else if (matrixPercent > 0) matrixColor = "orange";

            return (
              <div
                key={itemKey}
                style={{
                  marginTop: 10,
                  padding: 10,
                  border: "1px solid #eee",
                  borderRadius: 8,
                }}
              >
                <strong>📌 {itemKey}</strong>

                <div style={{ color: matrixColor, marginTop: 5 }}>
                  {getMatrixLabel(matrixPercent)} — {matrixPercent}%
                </div>

                <div style={{ marginTop: 8 }}>
                  {reqs.map((req) => (
                    <div
                      key={req.id}
                      style={{
                        fontSize: 13,
                        padding: "4px 0",
                        borderBottom: "1px solid #f0f0f0",
                      }}
                    >
                      • {req.name} —{" "}
                      <span style={{ color: "gray" }}>
                        {req.evidencia || "Sin evidencia"}
                      </span>{" "}
                      —{" "}
                      <span
                        style={{
                          color: getStatusColor(
                            (req.status || "no_conforme") as RequirementStatus
                          ),
                        }}
                      >
                        {req.status || "no_conforme"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}