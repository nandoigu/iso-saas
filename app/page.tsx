"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  getProjectRoleBadgeStyle,
  getProjectRoleLabel,
} from "@/app/lib/projectRoles";

type Project = {
  id: string;
  name: string;
  code?: string | null;
  role: string;
};

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    fetch("/api/projects", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setProjects(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        console.error("Error cargando proyectos:", error);
        setProjects([]);
      });
  }, []);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 40 }}>
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
            Monitorizacion de cumplimiento de requisitos
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 30 }}>
        <Link
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
          Ir al Dashboard
        </Link>
      </div>

      <div style={{ marginTop: 20 }}>
        <h2>Proyectos</h2>

        {projects.length === 0 && (
          <p style={{ color: "#888" }}>No hay proyectos</p>
        )}

        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/projects/${encodeURIComponent(p.id)}`}
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
              {p.code || "Sin codigo"}
            </div>
            <div style={{ marginTop: 10 }}>
              <span
                style={{
                  ...projectRoleBadgeBaseStyle,
                  ...getProjectRoleBadgeStyle(p.role),
                }}
              >
                {getProjectRoleLabel(p.role)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}

const projectRoleBadgeBaseStyle: React.CSSProperties = {
  borderRadius: 999,
  display: "inline-flex",
  fontSize: 12,
  fontWeight: 800,
  padding: "6px 10px",
};
