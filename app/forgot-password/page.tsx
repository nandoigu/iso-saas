"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deliveryHint, setDeliveryHint] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    setDeliveryHint("");

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
        setError(data.error || "No se pudo procesar la solicitud.");
        return;
      }

      setSuccess(
        data?.data?.message ||
          "Si existe una cuenta con ese email, te enviaremos un enlace de recuperacion."
      );
      setDeliveryHint(data?.data?.deliveryHint || "");
    } catch {
      setError("No se pudo procesar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <h1 style={{ margin: 0 }}>Recuperar contrasena</h1>
        <p style={subtitleStyle}>
          Introduce tu email y te enviaremos un enlace seguro para restablecerla.
        </p>

        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
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

          {error && <p style={errorStyle}>{error}</p>}
          {success && <p style={successStyle}>{success}</p>}
          {deliveryHint && <p style={hintStyle}>{deliveryHint}</p>}

          <button type="submit" disabled={loading} style={buttonStyle}>
            {loading ? "Enviando..." : "Enviar enlace"}
          </button>
        </form>

        <p style={{ color: "#6b7280", marginTop: 18 }}>
          <Link href="/login" style={{ color: "#2563eb", fontWeight: 700 }}>
            Volver al login
          </Link>
        </p>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  display: "grid",
  minHeight: "calc(100vh - 70px)",
  placeItems: "center",
  padding: 24,
};

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
  maxWidth: 460,
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

const hintStyle: React.CSSProperties = {
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: 8,
  color: "#1d4ed8",
  margin: 0,
  padding: 10,
};
