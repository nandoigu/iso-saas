"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Requirement = {
  id: string;
  norma?: string | null;
  item?: string | null;
  name: string;
  evidencia?: string | null;
  status?: "total" | "parcial" | "no_conforme" | null;
  deadline?: string | null;
};

export default function ProjectClient() {
  const params = useParams();
  const projectId = params?.id as string;

  const [requirements, setRequirements] = useState<Requirement[]>([]);

  const [norma, setNorma] = useState("");
  const [item, setItem] = useState("");
  const [name, setName] = useState("");
  const [evidencia, setEvidencia] = useState("");
  const [status, setStatus] = useState<"total" | "parcial" | "no_conforme">(
    "no_conforme"
  );
  const [deadline, setDeadline] = useState("");

  // 🔄 Cargar requisitos
  const loadRequirements = async () => {
    if (!projectId) return;

    const res = await fetch(`/api/requirements?projectId=${projectId}`);
    const data = await res.json();

    setRequirements(data.data || []);
  };

  useEffect(() => {
    loadRequirements();
  }, [projectId]);

  // ➕ Crear requisito
  const createRequirement = async () => {
    if (!name.trim()) {
      alert("El requerimiento es obligatorio");
      return;
    }

    const res = await fetch("/api/requirements", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId,
        norma,
        item, // 🔥 IMPORTANTE
        name,
        evidencia,
        status,
        deadline,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("ERROR BACKEND:", data);
      alert("Error creando requisito");
      return;
    }

    // 🔄 Reset
    setNorma("");
    setItem("");
    setName("");
    setEvidencia("");
    setStatus("no_conforme");
    setDeadline("");

    loadRequirements();
  };

  // 🔁 Actualizar estado
  const updateStatus = async (
    id: string,
    newStatus: "total" | "parcial" | "no_conforme"
  ) => {
    await fetch("/api/requirements", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        status: newStatus,
      }),
    });

    loadRequirements();
  };

  // 📊 Cálculos
  const total = requirements.length;

  const completed = requirements.filter(
    (r) => r.status === "total"
  ).length;

  const percent =
    total > 0 ? Math.round((completed / total) * 100) : 0;

  const overdue = requirements.filter(
    (r) =>
      r.deadline &&
      new Date(r.deadline) < new Date() &&
      r.status !== "total"
  ).length;

  const getColor = () => {
    if (percent === 100) return "green";
    if (percent > 50) return "#4caf50";
    if (percent > 20) return "orange";
    return "gray";
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>Gestión de Cumplimiento</h2>

      {/* 🧾 FORMULARIO */}
      <div style={{ marginBottom: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          placeholder="Norma (ISO 19650...)"
          value={norma}
          onChange={(e) => setNorma(e.target.value)}
        />

        <input
          placeholder="Ítem (ej: 5.5.1)"
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
          onChange={(e) =>
            setStatus(e.target.value as "total" | "parcial" | "no_conforme")
          }
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

        <button onClick={createRequirement}>
          Añadir
        </button>
      </div>

      {/* 📊 PROGRESO */}
      <p>Cumplimiento: {percent}%</p>

      <div
        style={{
          height: 12,
          background: "#eee",
          borderRadius: 10,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: "100%",
            background: getColor(),
            borderRadius: 10,
          }}
        />
      </div>

      {/* ⚠️ ALERTAS */}
      {overdue > 0 && (
        <p style={{ color: "red" }}>
          ⚠️ {overdue} requisitos vencidos
        </p>
      )}

      {/* 📋 LISTA */}
      {requirements.map((r) => {
        let color = "gray";
        const st = r.status || "no_conforme";

        if (st === "total") color = "green";
        if (st === "parcial") color = "orange";
        if (st === "no_conforme") color = "red";

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
            {/* 🔥 NORMA + ITEM */}
            <strong>
              {r.norma || "Sin norma"} {r.item ? `· ${r.item}` : ""}
            </strong>

            <div>{r.name}</div>

            <div style={{ fontSize: 12 }}>
              📎 {r.evidencia || "Sin evidencia"}
            </div>

            <div style={{ color }}>
              {st}
            </div>

            <div style={{ fontSize: 12 }}>
              📅{" "}
              {r.deadline
                ? new Date(r.deadline).toLocaleDateString()
                : "Sin fecha"}
            </div>

            <select
              value={st}
              onChange={(e) =>
                updateStatus(
                  r.id,
                  e.target.value as "total" | "parcial" | "no_conforme"
                )
              }
              style={{ marginTop: 8 }}
            >
              <option value="total">Total</option>
              <option value="parcial">Parcial</option>
              <option value="no_conforme">No conforme</option>
            </select>
          </div>
        );
      })}
    </div>
  );
}