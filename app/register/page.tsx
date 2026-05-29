"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Notice } from "@/components/Notice";
import {
  appAuthCardStyle,
  appAuthPageStyle,
  appAuthSubtitleStyle,
  appAuthTitleStyle,
  appFieldStyle,
  appFormLabelStyle,
  appFullWidthPrimaryButtonStyle,
  appLinkStyle,
  getActionStateStyle,
} from "@/components/uiStyles";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudo crear la cuenta");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Error inesperado creando la cuenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <span style={authKickerStyle}>BMO ISO 19650</span>
        <h1 style={appAuthTitleStyle}>Crea tu espacio de control ISO 19650</h1>
        <p style={appAuthSubtitleStyle}>
          Organiza proyectos, requisitos, evidencias y alertas desde un entorno
          preparado para equipos BIM y cumplimiento documental.
        </p>

        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
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
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              style={inputStyle}
            />
          </label>

          {error && <Notice tone="error" message={error} compact />}

          <button
            type="submit"
            disabled={loading}
            aria-disabled={loading}
            style={{ ...buttonStyle, ...getActionStateStyle(loading) }}
          >
            {loading ? "Creando..." : "Crear cuenta"}
          </button>
        </form>

        <p style={{ color: "#6b7280", marginTop: 18 }}>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" style={appLinkStyle}>
            Entrar
          </Link>
        </p>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  ...appAuthPageStyle,
};

const cardStyle: React.CSSProperties = {
  ...appAuthCardStyle,
  maxWidth: 440,
};

const authKickerStyle: React.CSSProperties = {
  color: "#0025df",
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 8,
  textTransform: "uppercase",
};

const labelStyle: React.CSSProperties = {
  ...appFormLabelStyle,
};

const inputStyle: React.CSSProperties = {
  ...appFieldStyle,
};

const buttonStyle: React.CSSProperties = {
  ...appFullWidthPrimaryButtonStyle,
};
