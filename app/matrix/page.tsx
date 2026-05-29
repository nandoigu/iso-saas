"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import {
  appHeroActionsStyle,
  appHeroCopyStyle,
  appHeroDescriptionStyle,
  appHeroEyebrowStyle,
  appHeroStyle,
  appHeroTitleStyle,
  appPageStyle,
  appPanelStyle,
  appPrimaryButtonStyle,
  appSecondaryButtonStyle,
} from "@/components/uiStyles";

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
    <main style={appPageStyle}>
      <section style={appHeroStyle}>
        <div style={appHeroCopyStyle}>
          <span style={appHeroEyebrowStyle}>Trazabilidad documental</span>
          <h1 style={appHeroTitleStyle}>Matriz de cumplimiento</h1>
          <p style={appHeroDescriptionStyle}>
            Selecciona un proyecto para revisar requisitos, evidencias y estado de
            cumplimiento en formato matriz.
          </p>
        </div>

        <div style={appHeroActionsStyle}>
          <Link href="/projects" style={secondaryLinkStyle}>
            Gestionar proyectos
          </Link>
          <Link href="/dashboard" style={primaryLinkStyle}>
            Ver dashboard
          </Link>
        </div>
      </section>

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
            margin: "0 auto",
            maxWidth: 1360,
          }}
        >
          {projects.map((project) => (
            <article
              key={project.id}
              style={{
                ...appPanelStyle,
                display: "grid",
                gap: 14,
                padding: 18,
              }}
            >
              <div>
                <div
                  style={{
                    color: "#5f7289",
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: 0,
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

const primaryLinkStyle: React.CSSProperties = {
  ...appPrimaryButtonStyle,
  display: "inline-flex",
  justifyContent: "center",
  padding: "10px 14px",
  textDecoration: "none",
};

const secondaryLinkStyle: React.CSSProperties = {
  ...appSecondaryButtonStyle,
  display: "inline-flex",
  justifyContent: "center",
  padding: "10px 14px",
  textDecoration: "none",
};
