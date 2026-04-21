"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        setProjects(data || []);
      });
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>📁 Proyectos</h2>

      {projects.length === 0 && <p>No hay proyectos</p>}

      {projects.map((p) => (
        <div
          key={p.id}
          onClick={() => router.push(`/projects/${p.id}`)}
          style={{
            padding: 15,
            border: "1px solid #ddd",
            borderRadius: 8,
            marginBottom: 10,
            cursor: "pointer",
          }}
        >
          <strong>{p.name}</strong>
          <div style={{ fontSize: 12 }}>
            {p.code || "Sin código"}
          </div>
        </div>
      ))}
    </div>
  );
}