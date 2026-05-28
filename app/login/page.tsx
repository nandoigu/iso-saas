"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
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

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordToggleHovered, setIsPasswordToggleHovered] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [nextPath, setNextPath] = useState("/dashboard");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    const safeNext = next?.startsWith("/") ? next : "/dashboard";

    setNextPath(safeNext);

    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => {
        if (res.ok) {
          router.replace(safeNext);
        }
      })
      .catch(() => {
        // Stay on login when the session check cannot be completed.
      });
  }, [router]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudo iniciar sesión");
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setError("Error inesperado iniciando sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <h1 style={appAuthTitleStyle}>Iniciar sesión</h1>
        <p style={appAuthSubtitleStyle}>
          Accede a tus proyectos y requerimientos ISO 19650.
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

          <label style={labelStyle}>
            Contraseña
            <div style={passwordFieldStyle}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                style={passwordInputStyle}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                onMouseEnter={() => setIsPasswordToggleHovered(true)}
                onMouseLeave={() => setIsPasswordToggleHovered(false)}
                style={{
                  ...passwordToggleStyle,
                  background: isPasswordToggleHovered ? "#eff6ff" : "transparent",
                  color: isPasswordToggleHovered ? "#1d4ed8" : "#0025df",
                }}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
                title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </label>

          {error && <Notice tone="error" message={error} compact />}

          <button
            type="submit"
            disabled={loading}
            aria-disabled={loading}
            style={{ ...buttonStyle, ...getActionStateStyle(loading) }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p style={{ margin: "14px 0 0" }}>
          <Link href="/forgot-password" style={appLinkStyle}>
            He olvidado mi contraseña
          </Link>
        </p>

        <p style={{ color: "#6b7280", marginTop: 18 }}>
          ¿No tienes cuenta?{" "}
          <Link href="/register" style={appLinkStyle}>
            Crear cuenta
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

const labelStyle: React.CSSProperties = {
  ...appFormLabelStyle,
};

const inputStyle: React.CSSProperties = {
  ...appFieldStyle,
};

const passwordFieldStyle: React.CSSProperties = {
  alignItems: "center",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  display: "flex",
  minHeight: 40,
  overflow: "hidden",
};

const passwordInputStyle: React.CSSProperties = {
  ...inputStyle,
  border: "none",
  borderRadius: 0,
  flex: 1,
  minWidth: 0,
  outline: "none",
};

const passwordToggleStyle: React.CSSProperties = {
  alignItems: "center",
  background: "transparent",
  border: "none",
  color: "#0025df",
  cursor: "pointer",
  display: "inline-flex",
  fontSize: 13,
  fontWeight: 600,
  justifyContent: "center",
  minHeight: 40,
  outlineColor: "#0025df",
  outlineOffset: -2,
  padding: "0 12px",
  transition: "background 140ms ease, color 140ms ease",
  whiteSpace: "nowrap",
};

const buttonStyle: React.CSSProperties = {
  ...appFullWidthPrimaryButtonStyle,
};

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 18, height: 18 }}
    >
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 18, height: 18 }}
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 10.7A3 3 0 0 0 12 15a3 3 0 0 0 2.3-1.1" />
      <path d="M9.4 5.3A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.1 3.8" />
      <path d="M6.7 6.7C4.1 8.3 2 12 2 12a18.8 18.8 0 0 0 5.2 5.4" />
    </svg>
  );
}
