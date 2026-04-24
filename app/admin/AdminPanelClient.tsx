"use client";

import { useCallback, useEffect, useState } from "react";

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  projectCount: number;
};

type Project = {
  id: string;
  name: string;
  code?: string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
  } | null;
};

export default function AdminPanelClient({
  currentUserEmail,
}: {
  currentUserEmail: string;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [usersRes, projectsRes] = await Promise.all([
        fetch("/api/admin/users", { cache: "no-store" }),
        fetch("/api/projects", { cache: "no-store" }),
      ]);

      if (!usersRes.ok || !projectsRes.ok) {
        throw new Error("No se pudieron cargar los datos de administracion.");
      }

      const [usersData, projectsData] = await Promise.all([
        usersRes.json(),
        projectsRes.json(),
      ]);

      setUsers(Array.isArray(usersData.data) ? usersData.data : []);
      setProjects(Array.isArray(projectsData.data) ? projectsData.data : []);
    } catch (loadError) {
      console.error(loadError);
      setError("No se pudo cargar el panel de administracion.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateUserRole = async (userId: string, role: string) => {
    setSavingUserId(userId);
    setError("");

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "No se pudo actualizar el rol.");
      }

      setUsers((current) =>
        current.map((entry) => (entry.id === userId ? data.data : entry))
      );
    } catch (updateError) {
      console.error(updateError);
      setError(
        updateError instanceof Error
          ? updateError.message
          : "No se pudo actualizar el rol."
      );
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <main style={{ display: "grid", gap: 24 }}>
      <section style={heroCardStyle}>
        <div>
          <h1 style={{ margin: 0, color: "#0f172a" }}>Panel de administracion</h1>
          <p style={{ color: "#64748b", margin: "8px 0 0" }}>
            Gestion centralizada de usuarios, roles y visibilidad global de proyectos.
          </p>
        </div>
        <div style={pillStyle}>{currentUserEmail}</div>
      </section>

      {error && <p style={errorStyle}>{error}</p>}

      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={{ margin: 0 }}>Usuarios</h2>
          <button onClick={loadData} style={buttonStyle} disabled={loading}>
            {loading ? "Actualizando..." : "Recargar"}
          </button>
        </div>

        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Rol</th>
                <th style={thStyle}>Proyectos</th>
                <th style={thStyle}>Fecha alta</th>
                <th style={thStyle}>Accion</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 700 }}>{user.name || user.email}</div>
                    <div style={{ color: "#64748b", fontSize: 13 }}>{user.email}</div>
                  </td>
                  <td style={tdStyle}>{user.role}</td>
                  <td style={tdStyle}>{user.projectCount}</td>
                  <td style={tdStyle}>{formatDate(user.createdAt)}</td>
                  <td style={tdStyle}>
                    <select
                      value={user.role}
                      onChange={(event) => updateUserRole(user.id, event.target.value)}
                      disabled={savingUserId === user.id}
                      style={selectStyle}
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                </tr>
              ))}
              {!loading && users.length === 0 && (
                <tr>
                  <td style={emptyStyle} colSpan={5}>
                    No hay usuarios registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={{ margin: 0 }}>Todos los proyectos</h2>
          <span style={{ color: "#64748b", fontSize: 14 }}>{projects.length} proyectos</span>
        </div>

        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Proyecto</th>
                <th style={thStyle}>Codigo</th>
                <th style={thStyle}>Propietario</th>
                <th style={thStyle}>Creado</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td style={tdStyle}>{project.name}</td>
                  <td style={tdStyle}>{project.code || "Sin codigo"}</td>
                  <td style={tdStyle}>{project.user?.name || project.user?.email || "Sin usuario"}</td>
                  <td style={tdStyle}>{formatDate(project.createdAt)}</td>
                </tr>
              ))}
              {!loading && projects.length === 0 && (
                <tr>
                  <td style={emptyStyle} colSpan={4}>
                    No hay proyectos para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
  }).format(new Date(value));
}

const heroCardStyle: React.CSSProperties = {
  alignItems: "center",
  background: "white",
  border: "1px solid #dbe3f1",
  borderRadius: 16,
  boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  padding: 24,
};

const sectionStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #dbe3f1",
  borderRadius: 16,
  boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
  padding: 24,
};

const sectionHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 16,
};

const pillStyle: React.CSSProperties = {
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: 999,
  color: "#1d4ed8",
  fontSize: 13,
  fontWeight: 700,
  padding: "8px 12px",
};

const tableWrapperStyle: React.CSSProperties = {
  overflowX: "auto",
};

const tableStyle: React.CSSProperties = {
  borderCollapse: "collapse",
  width: "100%",
};

const thStyle: React.CSSProperties = {
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: 13,
  padding: "12px 14px",
  textAlign: "left",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #e2e8f0",
  color: "#0f172a",
  fontSize: 14,
  padding: "14px",
  verticalAlign: "top",
};

const emptyStyle: React.CSSProperties = {
  color: "#64748b",
  padding: 20,
  textAlign: "center",
};

const buttonStyle: React.CSSProperties = {
  background: "#0025df",
  border: "1px solid #0025df",
  borderRadius: 8,
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
  minHeight: 40,
  padding: "0 14px",
};

const selectStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  minHeight: 38,
  padding: "0 10px",
};

const errorStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: 10,
  color: "#991b1b",
  margin: 0,
  padding: 12,
};
