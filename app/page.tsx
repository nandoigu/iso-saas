"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Home() {
  const [projects, setProjects] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const loadProjects = async () => {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(data.data || []);
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const createProject = async () => {
    if (!name || !code) return;

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, code }),
    });

    if (!res.ok) {
      console.error("Error creando proyecto");
      return;
    }

    setName("");
    setCode("");
    loadProjects();
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>ISO 19650 SaaS</h1>

      <h2>Crear proyecto</h2>

      <input
        placeholder="Nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        placeholder="Código"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        style={{ marginLeft: 10 }}
      />

      <button onClick={createProject} style={{ marginLeft: 10 }}>
        Crear
      </button>

      <h2 style={{ marginTop: 20 }}>Proyectos</h2>

      {projects.map((p: any) => (
        <div key={p.id}>
          <Link href={`/projects/${p.id}`}>
            {p.name} ({p.code})
          </Link>
        </div>
      ))}

      <div style={{ marginTop: 20 }}>
        <Link href="/dashboard">Ir al dashboard</Link>
      </div>
    </div>
  );
}