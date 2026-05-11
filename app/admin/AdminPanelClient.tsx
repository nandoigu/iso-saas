"use client";

import { useCallback, useEffect, useState } from "react";
import { Notice } from "@/components/Notice";

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  companyName: string | null;
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
  currentUserId,
}: {
  currentUserEmail: string;
  currentUserId: string;
}) {
  const isCompact = useAdminBreakpoint() === "compact";
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccess("");

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
      setProjects(Array.isArray(projectsData) ? projectsData : []);
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

  const updateUser = async ({
    userId,
    role,
    status,
  }: {
    userId: string;
    role?: string;
    status?: string;
  }) => {
    setSavingUserId(userId);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, role, status }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "No se pudo actualizar el usuario.");
      }

      setUsers((current) =>
        current.map((entry) => (entry.id === userId ? data.data : entry))
      );
      setSuccess(`Usuario ${data.data.email} actualizado correctamente.`);
    } catch (updateError) {
      console.error(updateError);
      setError(
        updateError instanceof Error
          ? updateError.message
          : "No se pudo actualizar el usuario."
      );
    } finally {
      setSavingUserId(null);
    }
  };

  const deleteUser = async (user: AdminUser) => {
    const confirmed = window.confirm(
      `Vas a eliminar al usuario ${user.email} y todos sus proyectos y requerimientos. Esta accion no se puede deshacer.`
    );

    if (!confirmed) {
      return;
    }

    setSavingUserId(user.id);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/admin/users?userId=${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "No se pudo eliminar el usuario.");
      }

      setUsers((current) => current.filter((entry) => entry.id !== user.id));
      setProjects((current) =>
        current.filter((project) => project.user?.id !== user.id)
      );
      setSuccess(`Usuario ${user.email} eliminado correctamente.`);
    } catch (deleteError) {
      console.error(deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el usuario."
      );
    } finally {
      setSavingUserId(null);
    }
  };

  const deleteProject = async (project: Project) => {
    const confirmed = window.confirm(
      `Seguro que quieres eliminar el proyecto "${project.name}"? Se eliminaran tambien sus requerimientos y esta accion no se puede deshacer.`
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

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "No se pudo eliminar el proyecto.");
      }

      setProjects((current) => current.filter((entry) => entry.id !== project.id));
      setUsers((current) =>
        current.map((user) =>
          user.id === project.user?.id
            ? { ...user, projectCount: Math.max(0, user.projectCount - 1) }
            : user
        )
      );
      setSuccess(`Proyecto ${project.name} eliminado correctamente.`);
    } catch (deleteError) {
      console.error(deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el proyecto."
      );
    } finally {
      setDeletingProjectId(null);
    }
  };

  return (
    <main
      style={{
        display: "grid",
        gap: isCompact ? 18 : 24,
        minWidth: 0,
      }}
    >
      <section
        style={{
          ...heroCardStyle,
          ...(isCompact ? compactHeroCardStyle : {}),
        }}
      >
        <div>
          <h1 style={{ margin: 0, color: "#0f172a" }}>Panel de administracion</h1>
          <p style={{ color: "#64748b", margin: "8px 0 0" }}>
            Gestion centralizada de usuarios, roles y visibilidad global de proyectos.
          </p>
        </div>
        <div style={pillStyle}>{currentUserEmail}</div>
      </section>

      {error && <Notice tone="error" message={error} />}
      {success && <Notice tone="success" message={success} />}

      <section style={{ ...sectionStyle, ...(isCompact ? compactSectionStyle : {}) }}>
        <div style={sectionIntroStyle}>
          <span style={sectionEyebrowStyle}>Gestion de accesos</span>
          <div
            style={{
              ...sectionHeaderStyle,
              ...(isCompact ? compactSectionHeaderStyle : {}),
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>Usuarios</h2>
              <p style={sectionDescriptionStyle}>
                Control de roles, estado de cuenta y administracion de usuarios registrados.
              </p>
            </div>
            <button
              onClick={loadData}
              style={{
                ...buttonStyle,
                width: isCompact ? "100%" : undefined,
              }}
              disabled={loading}
            >
              {loading ? "Actualizando..." : "Recargar"}
            </button>
          </div>
        </div>

        <div style={tableWrapperStyle}>
          <table style={{ ...tableStyle, minWidth: 920 }}>
            <thead>
              <tr>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Empresa</th>
                <th style={thStyle}>Rol</th>
                <th style={thStyle}>Estado</th>
                <th style={thStyle}>Proyectos</th>
                <th style={thStyle}>Fecha alta</th>
                <th style={thStyle}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 700 }}>{user.name || user.email}</div>
                    <div style={{ color: "#64748b", fontSize: 13 }}>{user.email}</div>
                  </td>
                  <td style={tdStyle}>{user.companyName || "Sin empresa"}</td>
                  <td style={tdStyle}>
                    <span style={getRoleBadgeStyle(user.role)}>{user.role}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={getStatusBadgeStyle(user.status)}>{getStatusLabel(user.status)}</span>
                  </td>
                  <td style={tdStyle}>{user.projectCount}</td>
                  <td style={tdStyle}>{formatDate(user.createdAt)}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "grid", gap: 8 }}>
                      <select
                        value={user.role}
                        onChange={(event) =>
                          updateUser({ userId: user.id, role: event.target.value })
                        }
                        disabled={savingUserId === user.id || user.id === currentUserId}
                        style={selectStyle}
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>

                      <select
                        value={user.status}
                        onChange={(event) =>
                          updateUser({ userId: user.id, status: event.target.value })
                        }
                        disabled={savingUserId === user.id || user.id === currentUserId}
                        style={selectStyle}
                      >
                        <option value="active">Activo</option>
                        <option value="suspended">Suspendido</option>
                        <option value="blocked">Bloqueado</option>
                      </select>

                      {user.id === currentUserId && (
                        <span style={helperTextStyle}>
                          Tu propia cuenta se protege desde la interfaz.
                        </span>
                      )}

                      {user.id !== currentUserId && (
                        <button
                          type="button"
                          onClick={() => deleteUser(user)}
                          disabled={savingUserId === user.id}
                          style={{
                            ...dangerButtonStyle,
                            opacity: savingUserId === user.id ? 0.6 : 1,
                            cursor: savingUserId === user.id ? "not-allowed" : "pointer",
                          }}
                        >
                          {savingUserId === user.id ? "Eliminando..." : "Eliminar usuario"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && users.length === 0 && (
                <tr>
                  <td style={emptyStyle} colSpan={7}>
                    No hay usuarios registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ ...sectionStyle, ...(isCompact ? compactSectionStyle : {}) }}>
        <div style={sectionIntroStyle}>
          <span style={sectionEyebrowStyle}>Vision global</span>
          <div
            style={{
              ...sectionHeaderStyle,
              ...(isCompact ? compactSectionHeaderStyle : {}),
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>Todos los proyectos</h2>
              <p style={sectionDescriptionStyle}>
                Vista consolidada de proyectos creados en la plataforma y su propietario actual.
              </p>
            </div>
            <span style={{ color: "#64748b", fontSize: 14 }}>{projects.length} proyectos</span>
          </div>
        </div>

        <div style={tableWrapperStyle}>
          <table style={{ ...tableStyle, minWidth: 760 }}>
            <thead>
              <tr>
                <th style={thStyle}>Proyecto</th>
                <th style={thStyle}>Codigo</th>
                <th style={thStyle}>Propietario</th>
                <th style={thStyle}>Creado</th>
                <th style={thStyle}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td style={tdStyle}>{project.name}</td>
                  <td style={tdStyle}>{project.code || "Sin codigo"}</td>
                  <td style={tdStyle}>{project.user?.name || project.user?.email || "Sin usuario"}</td>
                  <td style={tdStyle}>{formatDate(project.createdAt)}</td>
                  <td style={tdStyle}>
                    <button
                      type="button"
                      onClick={() => deleteProject(project)}
                      disabled={deletingProjectId === project.id}
                      style={{
                        ...dangerButtonStyle,
                        opacity: deletingProjectId === project.id ? 0.6 : 1,
                        cursor:
                          deletingProjectId === project.id ? "not-allowed" : "pointer",
                      }}
                    >
                      {deletingProjectId === project.id ? "Eliminando..." : "Eliminar proyecto"}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && projects.length === 0 && (
                <tr>
                  <td style={emptyStyle} colSpan={5}>
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

function getStatusLabel(status: string) {
  if (status === "blocked") return "Bloqueado";
  if (status === "suspended") return "Suspendido";
  return "Activo";
}

function useAdminBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<"compact" | "wide">("wide");

  useEffect(() => {
    const updateBreakpoint = () => {
      setBreakpoint(window.innerWidth < 900 ? "compact" : "wide");
    };

    updateBreakpoint();
    window.addEventListener("resize", updateBreakpoint);

    return () => {
      window.removeEventListener("resize", updateBreakpoint);
    };
  }, []);

  return breakpoint;
}

function getRoleBadgeStyle(role: string): React.CSSProperties {
  return {
    background: role === "admin" ? "#dbeafe" : "#eef2ff",
    border: `1px solid ${role === "admin" ? "#93c5fd" : "#c7d2fe"}`,
    borderRadius: 999,
    color: role === "admin" ? "#1d4ed8" : "#4338ca",
    display: "inline-flex",
    fontSize: 12,
    fontWeight: 800,
    padding: "6px 10px",
  };
}

function getStatusBadgeStyle(status: string): React.CSSProperties {
  const map = {
    active: { background: "#f0fdf4", border: "#bbf7d0", color: "#166534" },
    suspended: { background: "#fff7ed", border: "#fdba74", color: "#c2410c" },
    blocked: { background: "#fef2f2", border: "#fecaca", color: "#b91c1c" },
  } as const;

  const current = map[status as keyof typeof map] || map.active;

  return {
    background: current.background,
    border: `1px solid ${current.border}`,
    borderRadius: 999,
    color: current.color,
    display: "inline-flex",
    fontSize: 12,
    fontWeight: 800,
    padding: "6px 10px",
  };
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

const compactHeroCardStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "grid",
  padding: 18,
};

const sectionStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #dbe3f1",
  borderRadius: 16,
  boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
  padding: 24,
};

const compactSectionStyle: React.CSSProperties = {
  padding: 16,
};

const sectionIntroStyle: React.CSSProperties = {
  borderBottom: "1px solid #e8eef7",
  marginBottom: 18,
  paddingBottom: 16,
};

const sectionHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
};

const compactSectionHeaderStyle: React.CSSProperties = {
  alignItems: "stretch",
  display: "grid",
};

const sectionEyebrowStyle: React.CSSProperties = {
  color: "#2563eb",
  display: "inline-flex",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.04em",
  marginBottom: 10,
  textTransform: "uppercase",
};

const sectionDescriptionStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 14,
  margin: "6px 0 0",
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
  WebkitOverflowScrolling: "touch",
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
  boxSizing: "border-box",
  minHeight: 38,
  minWidth: 0,
  padding: "0 10px",
  width: "100%",
};

const helperTextStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.4,
};

const dangerButtonStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #fecaca",
  borderRadius: 8,
  color: "#b91c1c",
  fontWeight: 700,
  minHeight: 38,
  padding: "0 12px",
  width: "100%",
};
