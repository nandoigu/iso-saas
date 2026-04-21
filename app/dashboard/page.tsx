"use client";

import { useEffect, useMemo, useState } from "react";

type Requirement = {
  id: string;
  status?: "total" | "parcial" | "no_conforme" | null;
  deadline?: string | null;
};

type Project = {
  id: string;
  name: string;
  code?: string | null;
  requirements?: Requirement[];
};

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = async () => {
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      const data = await res.json();

      if (Array.isArray(data)) {
        setProjects(data);
      } else if (Array.isArray(data.data)) {
        setProjects(data.data);
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.error("Error cargando dashboard:", error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const metrics = useMemo(() => {
    let totalReqs = 0;
    let totalScore = 0;
    let overdue = 0;

    projects.forEach((project) => {
      (project.requirements || []).forEach((r) => {
        totalReqs++;

        if (r.status === "total") totalScore += 1;
        else if (r.status === "parcial") totalScore += 0.5;

        if (
          r.deadline &&
          new Date(r.deadline) < new Date() &&
          r.status !== "total"
        ) {
          overdue++;
        }
      });
    });

    const cumplimiento =
      totalReqs > 0 ? Math.round((totalScore / totalReqs) * 100) : 0;

    return {
      totalProjects: projects.length,
      totalReqs,
      cumplimiento,
      overdue,
    };
  }, [projects]);

  const getBarColor = (percent: number) => {
    if (percent === 100) return "#16a34a";
    if (percent > 50) return "#22c55e";
    if (percent > 20) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div>
      {/* CABECERA SIMPLE Y FIABLE */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 30,
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <p style={{ margin: "8px 0 0 0", color: "#666" }}>
            Vista global de cumplimiento
          </p>
        </div>

        <a
          href="/"
          style={{
            display: "inline-block",
            background: "white",
            color: "#111",
            padding: "10px 16px",
            borderRadius: 8,
            textDecoration: "none",
            border: "1px solid #ddd",
          }}
        >
          ← Volver al inicio
        </a>
      </div>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
        <Card title="Proyectos" value={metrics.totalProjects} />
        <Card title="Requisitos" value={metrics.totalReqs} />
        <Card title="Cumplimiento" value={`${metrics.cumplimiento}%`} />
        <Card title="Vencidos" value={metrics.overdue} />
      </div>

      {/* Barra global */}
      <div
        style={{
          height: 12,
          background: "#ddd",
          borderRadius: 10,
          overflow: "hidden",
          marginBottom: 30,
        }}
      >
        <div
          style={{
            width: `${metrics.cumplimiento}%`,
            height: "100%",
            background: getBarColor(metrics.cumplimiento),
          }}
        />
      </div>

      {/* Lista de proyectos */}
      <div style={{ marginTop: 20 }}>
        <h2>Proyectos</h2>

        {loading && <p>Cargando...</p>}

        {!loading && projects.length === 0 && <p>No hay proyectos</p>}

        {projects.map((p) => {
          const reqs = p.requirements || [];
          const total = reqs.length;
          const score = reqs.reduce((acc, r) => {
            if (r.status === "total") return acc + 1;
            if (r.status === "parcial") return acc + 0.5;
            return acc;
          }, 0);

          const percent = total > 0 ? Math.round((score / total) * 100) : 0;

          return (
            <a
              key={p.id}
              href={`/projects/${p.id}`}
              style={{
                display: "block",
                background: "white",
                padding: 20,
                marginBottom: 12,
                borderRadius: 10,
                border: "1px solid #eee",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <strong>{p.name}</strong>
              <div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
                {p.code || "Sin código"}
              </div>

              <div
                style={{
                  marginTop: 10,
                  height: 8,
                  background: "#eee",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${percent}%`,
                    height: "100%",
                    background: getBarColor(percent),
                  }}
                />
              </div>

              <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                {percent}% completado
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function Card({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div
      style={{
        background: "white",
        padding: 20,
        borderRadius: 12,
        minWidth: 150,
        boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ fontSize: 12, color: "#666" }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{value}</div>
    </div>
  );
}