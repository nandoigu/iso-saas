"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Dashboard() {
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        console.log("PROJECTS:", data);
        setProjects(data.data || []);
      })
      .catch((err) => {
        console.error("Error cargando proyectos:", err);
        setProjects([]);
      });
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h1>📊 Dashboard</h1>

      {projects.length === 0 && <p>No hay proyectos</p>}

      {projects.map((p) => {
        const reqs = p.requirements || [];

        const total = reqs.length;

        // ✅ NUEVA LÓGICA (status)
        const completed = reqs.filter(
          (r: any) => r.status === "total"
        ).length;

        const percent =
          total > 0
            ? Math.round((completed / total) * 100)
            : 0;

        const overdue = reqs.filter(
          (r: any) =>
            r.deadline &&
            new Date(r.deadline) < new Date() &&
            r.status !== "total"
        ).length;

        // 🎨 Estado visual
        let status = "⚪ Sin iniciar";
        let color = "gray";

        if (percent === 100) {
          status = "✅ Completado";
          color = "green";
        } else if (percent > 50) {
          status = "🟢 En progreso";
          color = "#4caf50";
        } else if (percent > 0) {
          status = "🟡 Bajo progreso";
          color = "orange";
        }

        if (overdue > 0) {
          status = "🔴 Riesgo";
          color = "red";
        }

        return (
          <div
            key={p.id}
            style={{
              border: "1px solid #ddd",
              padding: 20,
              marginBottom: 20,
              borderRadius: 10,
            }}
          >
            <h3>{p.name}</h3>

            <p style={{ color }}>{status}</p>

            <p>
              Progreso: {percent}% ({completed}/{total})
            </p>

            {/* BARRA */}
            <div
              style={{
                height: 10,
                background: "#eee",
                borderRadius: 10,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: `${percent}%`,
                  height: "100%",
                  background: color,
                  borderRadius: 10,
                }}
              />
            </div>

            {/* ALERTA */}
            {overdue > 0 && (
              <p style={{ color: "red" }}>
                ⚠️ {overdue} requisitos vencidos
              </p>
            )}

            {/* SIN DATOS */}
            {total === 0 && (
              <p style={{ color: "gray" }}>
                Sin requisitos
              </p>
            )}

            <Link href={`/projects/${p.id}`}>
              Ver proyecto →
            </Link>
          </div>
        );
      })}
    </div>
  );
}