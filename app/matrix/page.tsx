"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Project = {
  id: string;
  name: string;
  code?: string | null;
  requirements?: Array<{ id: string }>;
};

export default function MatrixIndexPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/projects", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) {
          throw new Error("No se pudieron cargar los proyectos");
        }

        return res.json();
      })
      .then((data) => {
        setProjects(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Error cargando matrices:", err);
        setError("No se pudo cargar el listado de matrices.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <main style={{ padding: 40 }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Matriz de cumplimiento</h1>
        <p style={{ color: "#5f7289", margin: "8px 0 0" }}>
          Selecciona un proyecto para abrir su matriz de cumplimiento.
        </p>
      </header>

      {loading && <EmptyState title="Cargando" description="Obteniendo proyectos." />}
      {!loading && error && (
        <EmptyState title="Error" description={error} tone="risk" />
      )}

      {!loading && !error && projects.length === 0 && (
        <EmptyState
          title="Sin proyectos"
          description="Crea un proyecto para empezar a trabajar con matrices."
        />
      )}

      {!loading && !error && projects.length > 0 && (
        <section
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          {projects.map((project) => (
            <article
              key={project.id}
              style={{
                background: "white",
                border: "1px solid #dbe3f1",
                borderRadius: 12,
                boxShadow: "0 6px 18px rgba(0, 42, 78, 0.05)",
                display: "grid",
                gap: 14,
                padding: 20,
              }}
            >
              <div>
                <div
                  style={{
                    color: "#5f7289",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  {project.code || "Sin código"}
                </div>
                <h2
                  style={{
                    color: "#002a4e",
                    fontSize: 18,
                    lineHeight: 1.35,
                    margin: "8px 0 0",
                  }}
                >
                  {project.name}
                </h2>
              </div>

              <div style={{ color: "#5f7289", fontSize: 13 }}>
                {project.requirements?.length || 0} requerimientos vinculados
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href={`/projects/${project.id}/matrix`} style={primaryLinkStyle}>
                  Abrir matriz
                </Link>
                <Link href={`/projects/${project.id}`} style={secondaryLinkStyle}>
                  Ver proyecto
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
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
        border: `1px dashed ${tone === "risk" ? "#fca5a5" : "#dbe3f1"}`,
        borderRadius: 12,
        color: tone === "risk" ? "#991b1b" : "#5f7289",
        padding: 24,
        textAlign: "center",
      }}
    >
      <strong style={{ color: tone === "risk" ? "#991b1b" : "#002a4e" }}>
        {title}
      </strong>
      <p style={{ margin: "6px 0 0" }}>{description}</p>
    </div>
  );
}

const primaryLinkStyle: React.CSSProperties = {
  background: "#0025df",
  border: "1px solid #0025df",
  borderRadius: 8,
  color: "white",
  fontWeight: 700,
  padding: "10px 14px",
  textDecoration: "none",
};

const secondaryLinkStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #dbe3f1",
  borderRadius: 8,
  color: "#002a4e",
  fontWeight: 700,
  padding: "10px 14px",
  textDecoration: "none",
};
