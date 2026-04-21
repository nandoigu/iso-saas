"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Project = {
  id: string;
  name: string;
  code?: string | null;
};

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);

  const loadProjects = async () => {
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : data.data || []);
    } catch (error) {
      console.error("Error cargando proyectos:", error);
      setProjects([]);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          marginBottom: 30,
        }}
      >
        <div style={{ width: 160, height: 70, position: "relative" }}>
          <Image
            src="/logo.png"
            alt="Logo"
            fill
            sizes="160px"
            style={{ objectFit: "contain" }}
            priority
          />
        </div>

        <div>
          <h1 style={{ margin: 0 }}>BMO ISO 19650 SaaS</h1>
          <p style={{ margin: 0, color: "#666" }}>
            Monitorización de cumplimiento de requisitos
          </p>
        </div>
      </div>

      {/* BOTÓN DASHBOARD */}
      <div style={{ marginBottom: 30 }}>
        <a
          href="/dashboard"
          style={{
            display: "inline-block",
            background: "#4caf50",
            color: "white",
            padding: "12px 20px",
            borderRadius: 8,
            textDecoration: "none",
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          Ir al Dashboard →
        </a>
      </div>

      {/* PROYECTOS */}
      <div style={{ marginTop: 20 }}>
        <h2>Proyectos</h2>

        {projects.length === 0 && (
          <p style={{ color: "#888" }}>No hay proyectos</p>
        )}

        {projects.map((p) => (
          <a
            key={p.id}
            href={`/projects/${p.id}`}
            style={{
              display: "block",
              padding: 15,
              border: "1px solid #eee",
              borderRadius: 10,
              marginBottom: 10,
              textDecoration: "none",
              color: "inherit",
              background: "white",
            }}
          >
            <strong>{p.name}</strong>
            <div style={{ fontSize: 12, color: "#666" }}>
              {p.code || "Sin código"}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}