"use client";

import { FormEvent, useState } from "react";

export default function SecurityPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("Las contrasenas no coinciden.");
      setLoading(false);
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
        setError(data.error || "No se pudo cambiar la contrasena.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Contrasena actualizada correctamente.");
    } catch {
      setError("No se pudo cambiar la contrasena.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <h1 style={{ margin: 0 }}>Seguridad de la cuenta</h1>
        <p style={subtitleStyle}>
          Cambia tu contrasena sin afectar el resto de funcionalidades de tu espacio.
        </p>

        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
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
              minLength={8}
              required
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Confirmar nueva contrasena
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
              style={inputStyle}
            />
          </label>

          {error && <p style={errorStyle}>{error}</p>}
          {success && <p style={successStyle}>{success}</p>}

          <button type="submit" disabled={loading} style={buttonStyle}>
            {loading ? "Guardando..." : "Actualizar contrasena"}
          </button>
        </form>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  padding: 32,
};

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
  margin: "0 auto",
  maxWidth: 520,
  padding: 28,
  width: "100%",
};

const subtitleStyle: React.CSSProperties = {
  color: "#6b7280",
  margin: "8px 0 24px",
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

const buttonStyle: React.CSSProperties = {
  background: "#2563eb",
  border: "1px solid #2563eb",
  borderRadius: 8,
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
  minHeight: 42,
};

const errorStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: 8,
  color: "#991b1b",
  margin: 0,
  padding: 10,
};

const successStyle: React.CSSProperties = {
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  borderRadius: 8,
  color: "#166534",
  margin: 0,
  padding: 10,
};
