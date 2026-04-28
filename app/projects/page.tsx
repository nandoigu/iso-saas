"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type Project = {
  id: string;
  name: string;
  code?: string | null;
};

type ImportResult = {
  imported: number;
  skippedDuplicates: number;
  totalRows: number;
};

export default function ProjectsPage() {
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [replaceTemplates, setReplaceTemplates] = useState(true);
  const [importError, setImportError] = useState("");
  const [importDetails, setImportDetails] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    const loadProjects = async () => {
      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/projects", { cache: "no-store" });

        if (res.status === 401) {
          router.push("/login");
          return;
        }

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Error cargando proyectos");
        }

        setProjects(data);
      } catch (loadError) {
        console.error("Error cargando proyectos:", loadError);
        setProjects([]);
        setError("No se pudieron cargar los proyectos.");
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, [router]);

  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const trimmedName = name.trim();
    const trimmedCode = code.trim();

    if (!trimmedName) {
      setError("El nombre es obligatorio.");
      return;
    }

    setCreating(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          code: trimmedCode || null,
        }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error creando proyecto");
      }

      setProjects((current) => [data as Project, ...current]);
      setName("");
      setCode("");
      setSuccess("Proyecto creado correctamente.");
    } catch (createError) {
      console.error("Error creando proyecto:", createError);
      setError(
        createError instanceof Error
          ? createError.message
          : "Error creando proyecto."
      );
    } finally {
      setCreating(false);
    }
  };

  const deleteProject = async (project: Project) => {
    const confirmed = window.confirm(
      `¿Seguro que quieres eliminar el proyecto "${project.name}"?`
    );

    if (!confirmed) {
      return;
    }

    setDeletingProjectId(project.id);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
        method: "DELETE",
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "No se pudo eliminar el proyecto.");
      }

      setProjects((current) => current.filter((entry) => entry.id !== project.id));
      setSuccess("Proyecto eliminado.");
    } catch (deleteError) {
      console.error("Error eliminando proyecto:", deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el proyecto."
      );
    } finally {
      setDeletingProjectId(null);
    }
  };

  const importRequirements = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setImportError("");
    setImportDetails([]);
    setImportResult(null);

    if (!importFile) {
      setImportError("Selecciona un archivo .xlsx.");
      return;
    }

    setImporting(true);

    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("replace", String(replaceTemplates));

      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setImportDetails(Array.isArray(data.details) ? data.details : []);
        throw new Error(data.error || "Error importando archivo.");
      }

      setImportResult(data.data);
      setImportFile(null);

      const input = document.getElementById(
        "requirements-import-file"
      ) as HTMLInputElement | null;

      if (input) {
        input.value = "";
      }
    } catch (loadError) {
      console.error("Error importando requisitos:", loadError);
      setImportError(
        loadError instanceof Error
          ? loadError.message
          : "Error importando archivo."
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 40 }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Proyectos</h1>
        <p style={{ color: "#6b7280", margin: "8px 0 0" }}>
          Crea proyectos e importa plantillas de requisitos ISO 19650 desde Excel.
        </p>
      </header>

      <section style={panelStyle}>
        <h3 style={{ margin: "0 0 8px" }}>Importar requisitos desde Excel</h3>
        <p style={{ color: "#6b7280", margin: "0 0 16px" }}>
          El archivo debe incluir exactamente: norma, item, requerimiento, evidencia,
          estado, fecha_limite. Los requisitos importados se aplicaran automaticamente
          a los nuevos proyectos.
        </p>

        <form
          onSubmit={importRequirements}
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "end",
          }}
        >
          <label style={labelStyle}>
            Archivo .xlsx
            <input
              id="requirements-import-file"
              type="file"
              accept=".xlsx"
              onChange={(event) => setImportFile(event.target.files?.[0] || null)}
              style={inputStyle}
            />
          </label>

          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={replaceTemplates}
              onChange={(event) => setReplaceTemplates(event.target.checked)}
            />
            Reemplazar plantilla actual
          </label>

          <button
            type="submit"
            disabled={importing}
            style={{
              ...buttonStyle,
              opacity: importing ? 0.7 : 1,
              cursor: importing ? "not-allowed" : "pointer",
            }}
          >
            {importing ? "Importando..." : "Importar Excel"}
          </button>
        </form>

        {importError && <p style={errorStyle}>{importError}</p>}

        {importDetails.length > 0 && (
          <ul style={detailsStyle}>
            {importDetails.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}

        {importResult && (
          <p style={successStyle}>
            Importacion completada: {importResult.imported} nuevos,{" "}
            {importResult.skippedDuplicates} duplicados omitidos,{" "}
            {importResult.totalRows} filas validas.
          </p>
        )}
      </section>

      <section style={panelStyle}>
        <h3 style={{ margin: "0 0 16px" }}>Crear proyecto</h3>

        <form
          onSubmit={createProject}
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "end",
          }}
        >
          <label style={labelStyle}>
            Nombre
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre"
              required
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Codigo
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Codigo"
              style={inputStyle}
            />
          </label>

          <button
            type="submit"
            disabled={creating}
            style={{
              ...buttonStyle,
              opacity: creating ? 0.7 : 1,
              cursor: creating ? "not-allowed" : "pointer",
            }}
          >
            {creating ? "Creando..." : "Crear proyecto"}
          </button>
        </form>

        {error && <p style={errorStyle}>{error}</p>}
        {success && <p style={successStyle}>{success}</p>}
      </section>

      <section>
        <h3 style={{ margin: "0 0 14px" }}>Listado</h3>

        {loading && <p style={{ color: "#6b7280" }}>Cargando...</p>}

        {!loading && projects.length === 0 && (
          <p style={{ color: "#888" }}>No hay proyectos</p>
        )}

        {!loading &&
          projects.map((project) => (
            <article key={project.id} style={projectCardStyle}>
              <Link
                href={`/projects/${encodeURIComponent(project.id)}`}
                style={{
                  color: "inherit",
                  display: "block",
                  flex: 1,
                  minWidth: 0,
                  textDecoration: "none",
                }}
              >
                <strong>{project.name}</strong>
                <div style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>
                  {project.code || "Sin codigo"}
                </div>
              </Link>

              <button
                type="button"
                onClick={() => deleteProject(project)}
                disabled={deletingProjectId === project.id}
                style={{
                  ...dangerButtonStyle,
                  cursor:
                    deletingProjectId === project.id ? "not-allowed" : "pointer",
                  opacity: deletingProjectId === project.id ? 0.6 : 1,
                }}
              >
                {deletingProjectId === project.id ? "Eliminando..." : "Eliminar"}
              </button>
            </article>
          ))}
      </section>
    </main>
  );
}

const panelStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  marginBottom: 30,
  padding: 20,
};

const labelStyle: React.CSSProperties = {
  color: "#374151",
  display: "grid",
  fontSize: 14,
  fontWeight: 700,
  gap: 6,
};

const checkboxLabelStyle: React.CSSProperties = {
  color: "#374151",
  display: "flex",
  gap: 8,
  alignItems: "center",
  fontSize: 14,
  fontWeight: 700,
  minHeight: 40,
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 8,
  minHeight: 40,
  minWidth: 220,
  padding: "8px 10px",
};

const buttonStyle: React.CSSProperties = {
  background: "#2563eb",
  border: "1px solid #2563eb",
  borderRadius: 8,
  color: "white",
  fontWeight: 700,
  minHeight: 40,
  padding: "9px 14px",
};

const errorStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: 8,
  color: "#991b1b",
  margin: "14px 0 0",
  padding: 10,
};

const successStyle: React.CSSProperties = {
  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  borderRadius: 8,
  color: "#166534",
  margin: "14px 0 0",
  padding: 10,
};

const detailsStyle: React.CSSProperties = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  borderRadius: 8,
  color: "#9a3412",
  margin: "14px 0 0",
  padding: "10px 10px 10px 28px",
};

const projectCardStyle: React.CSSProperties = {
  alignItems: "center",
  background: "white",
  border: "1px solid #ddd",
  borderRadius: 8,
  display: "flex",
  gap: 16,
  marginBottom: 10,
  padding: 12,
};

const dangerButtonStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #fecaca",
  borderRadius: 8,
  color: "#b91c1c",
  fontWeight: 700,
  minHeight: 40,
  padding: "9px 14px",
  whiteSpace: "nowrap",
};
