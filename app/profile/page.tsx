"use client";

import { FormEvent, useEffect, useState } from "react";
import { Notice } from "@/components/Notice";
import {
  appFieldStyle,
  appPanelStyle,
  appPrimaryButtonStyle,
  appSecondaryButtonStyle,
  getUserRoleBadgeStyle,
  getUserStatusBadgeStyle,
} from "@/components/uiStyles";

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
  const isCompact = useProfileBreakpoint() === "compact";
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
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      setSavingPassword(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
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
        throw new Error(data.error || "No se pudo cambiar la contraseña.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Contraseña actualizada correctamente.");
    } catch (passwordError) {
      console.error(passwordError);
      setError(
        passwordError instanceof Error
          ? passwordError.message
          : "No se pudo cambiar la contraseña."
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
        throw new Error(data.error || "No se pudo enviar el email de recuperación.");
      }

      setRecoverySuccess(
        data?.data?.message ||
          "Si existe una cuenta con ese email, te enviaremos un enlace de recuperación."
      );
    } catch (recoveryError) {
      console.error(recoveryError);
      setError(
        recoveryError instanceof Error
          ? recoveryError.message
          : "No se pudo enviar el email de recuperación."
      );
    } finally {
      setSendingRecovery(false);
    }
  };

  if (loading) {
    return <main style={{ ...pageStyle, ...(isCompact ? compactPageStyle : {}) }}>Cargando perfil...</main>;
  }

  return (
    <main style={{ ...pageStyle, ...(isCompact ? compactPageStyle : {}) }}>
      <section
        style={{
          ...heroCardStyle,
          ...(isCompact ? compactHeroCardStyle : {}),
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Perfil de usuario</h1>
          <p style={{ color: "#64748b", margin: "8px 0 0" }}>
            Gestiona tus datos de cuenta, tu rol visible y la seguridad de acceso.
          </p>
        </div>

        {user && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={profileBadgeStyle(getUserRoleBadgeStyle(user.role))}>
              {user.role.toUpperCase()}
            </span>
            <span style={profileBadgeStyle(getUserStatusBadgeStyle(user.status))}>
              {getStatusLabel(user.status)}
            </span>
          </div>
        )}
      </section>

      {user?.status === "suspended" && (
        <Notice
          tone="warning"
          message="Tu cuenta está suspendida. Algunas funciones pueden estar limitadas."
        />
      )}

      {error && <Notice tone="error" message={error} />}
      {success && <Notice tone="success" message={success} />}
      {passwordSuccess && <Notice tone="success" message={passwordSuccess} />}
      {recoverySuccess && <Notice tone="info" message={recoverySuccess} />}

      <div
        style={{
          ...contentGridStyle,
          gridTemplateColumns: isCompact
            ? "minmax(0, 1fr)"
            : "repeat(2, minmax(0, 1fr))",
        }}
      >
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
              Contraseña actual
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Nueva contraseña
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
              Confirmar contraseña
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
              {savingPassword ? "Actualizando..." : "Cambiar contraseña"}
            </button>
          </form>

          <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #e2e8f0" }}>
            <button
              type="button"
              disabled={sendingRecovery}
              onClick={sendRecoveryEmail}
              style={secondaryButtonStyle}
            >
              {sendingRecovery ? "Enviando..." : "Enviar email de recuperación"}
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

function profileBadgeStyle(style: React.CSSProperties): React.CSSProperties {
  return {
    ...style,
    letterSpacing: "0.04em",
    padding: "8px 12px",
  };
}

function useProfileBreakpoint() {
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

const pageStyle: React.CSSProperties = {
  display: "grid",
  gap: 24,
  padding: 32,
};

const compactPageStyle: React.CSSProperties = {
  padding: "20px 12px 32px",
};

const heroCardStyle: React.CSSProperties = {
  ...appPanelStyle,
  alignItems: "center",
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

const contentGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 24,
};

const cardStyle: React.CSSProperties = {
  ...appPanelStyle,
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
  ...appFieldStyle,
};

const primaryButtonStyle: React.CSSProperties = {
  ...appPrimaryButtonStyle,
  minHeight: 42,
  padding: "0 14px",
  width: "100%",
};

const secondaryButtonStyle: React.CSSProperties = {
  ...appSecondaryButtonStyle,
  minHeight: 42,
  padding: "0 14px",
  width: "100%",
};
