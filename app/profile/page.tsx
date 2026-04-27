"use client";

import { FormEvent, useEffect, useState } from "react";

type ProfileUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: string;
  companyName: string;
};

export default function ProfilePage() {
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [sendingRecovery, setSendingRecovery] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [recoverySuccess, setRecoverySuccess] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "No se pudo cargar el perfil.");
        }

        return data;
      })
      .then((data) => {
        const profile = data?.data?.user || null;
        setUser(profile);
        setName(profile?.name || "");
        setEmail(profile?.email || "");
        setCompanyName(profile?.companyName || "");
      })
      .catch((loadError) => {
        console.error(loadError);
        setError(
          loadError instanceof Error ? loadError.message : "No se pudo cargar el perfil."
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingProfile(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          companyName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "No se pudo actualizar el perfil.");
      }

      setUser(data.data.user);
      window.dispatchEvent(new CustomEvent("bmo:user-updated"));
      setSuccess("Perfil actualizado correctamente.");
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo actualizar el perfil."
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingPassword(true);
    setError("");
    setPasswordSuccess("");

    if (newPassword.length < 8) {
      setError("La nueva contrasena debe tener al menos 8 caracteres.");
      setSavingPassword(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contrasenas no coinciden.");
      setSavingPassword(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "No se pudo cambiar la contrasena.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Contrasena actualizada correctamente.");
    } catch (passwordError) {
      console.error(passwordError);
      setError(
        passwordError instanceof Error
          ? passwordError.message
          : "No se pudo cambiar la contrasena."
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const sendRecoveryEmail = async () => {
    if (!email) return;

    setSendingRecovery(true);
    setError("");
    setRecoverySuccess("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "No se pudo enviar el email de recuperacion.");
      }

      setRecoverySuccess(
        data?.data?.message ||
          "Si existe una cuenta con ese email, te enviaremos un enlace de recuperacion."
      );
    } catch (recoveryError) {
      console.error(recoveryError);
      setError(
        recoveryError instanceof Error
          ? recoveryError.message
          : "No se pudo enviar el email de recuperacion."
      );
    } finally {
      setSendingRecovery(false);
    }
  };

  if (loading) {
    return <main style={pageStyle}>Cargando perfil...</main>;
  }

  return (
    <main style={pageStyle}>
      <section style={heroCardStyle}>
        <div>
          <h1 style={{ margin: 0 }}>Perfil de usuario</h1>
          <p style={{ color: "#64748b", margin: "8px 0 0" }}>
            Gestiona tus datos de cuenta, tu rol visible y la seguridad de acceso.
          </p>
        </div>

        {user && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={getRoleBadgeStyle(user.role)}>{user.role.toUpperCase()}</span>
            <span style={getStatusBadgeStyle(user.status)}>{getStatusLabel(user.status)}</span>
          </div>
        )}
      </section>

      {user?.status === "suspended" && (
        <p style={warningStyle}>
          Tu cuenta esta suspendida. Algunas funciones pueden estar limitadas.
        </p>
      )}

      {error && <p style={errorStyle}>{error}</p>}
      {success && <p style={successStyle}>{success}</p>}
      {passwordSuccess && <p style={successStyle}>{passwordSuccess}</p>}
      {recoverySuccess && <p style={infoStyle}>{recoverySuccess}</p>}

      <div style={contentGridStyle}>
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Datos personales</h2>

          <form onSubmit={saveProfile} style={{ display: "grid", gap: 14 }}>
            <label style={labelStyle}>
              Nombre
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Empresa
              <input
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                style={inputStyle}
              />
            </label>

            <button type="submit" disabled={savingProfile} style={primaryButtonStyle}>
              {savingProfile ? "Guardando..." : "Guardar perfil"}
            </button>
          </form>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Seguridad</h2>

          <form onSubmit={changePassword} style={{ display: "grid", gap: 14 }}>
            <label style={labelStyle}>
              Contrasena actual
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Nueva contrasena
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                minLength={8}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Confirmar contrasena
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={8}
                style={inputStyle}
              />
            </label>

            <button type="submit" disabled={savingPassword} style={primaryButtonStyle}>
              {savingPassword ? "Actualizando..." : "Cambiar contrasena"}
            </button>
          </form>

          <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #e2e8f0" }}>
            <button
              type="button"
              disabled={sendingRecovery}
              onClick={sendRecoveryEmail}
              style={secondaryButtonStyle}
            >
              {sendingRecovery ? "Enviando..." : "Enviar email de recuperacion"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function getStatusLabel(status: string) {
  if (status === "blocked") return "Bloqueado";
  if (status === "suspended") return "Suspendido";
  return "Activo";
}

function getRoleBadgeStyle(role: string): React.CSSProperties {
  return {
    background: role === "admin" ? "#dbeafe" : "#eef2ff",
    border: `1px solid ${role === "admin" ? "#93c5fd" : "#c7d2fe"}`,
    borderRadius: 999,
    color: role === "admin" ? "#1d4ed8" : "#4338ca",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.04em",
    padding: "8px 12px",
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
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.04em",
    padding: "8px 12px",
  };
}

const pageStyle: React.CSSProperties = {
  display: "grid",
  gap: 24,
  padding: 32,
};

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

const contentGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 24,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #dbe3f1",
  borderRadius: 16,
  boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
  padding: 24,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 18px",
};

const labelStyle: React.CSSProperties = {
  color: "#374151",
  display: "grid",
  fontSize: 14,
  fontWeight: 700,
  gap: 6,
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 8,
  minHeight: 42,
  padding: "8px 10px",
};

const primaryButtonStyle: React.CSSProperties = {
  background: "#0025df",
  border: "1px solid #0025df",
  borderRadius: 8,
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
  minHeight: 42,
};

const secondaryButtonStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #dbe3f1",
  borderRadius: 8,
  color: "#002a4e",
  cursor: "pointer",
  fontWeight: 700,
  minHeight: 42,
  padding: "0 14px",
};

const warningStyle: React.CSSProperties = {
  background: "#fff7ed",
  border: "1px solid #fdba74",
  borderRadius: 10,
  color: "#c2410c",
  margin: 0,
  padding: 12,
};

const errorStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: 10,
  color: "#991b1b",
  margin: 0,
  padding: 12,
};

const successStyle: React.CSSProperties = {
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  borderRadius: 10,
  color: "#166534",
  margin: 0,
  padding: 12,
};

const infoStyle: React.CSSProperties = {
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: 10,
  color: "#1d4ed8",
  margin: 0,
  padding: 12,
};
