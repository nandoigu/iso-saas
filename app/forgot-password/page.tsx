"use client";

import Link from "next/link";
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
        <h1 style={appAuthTitleStyle}>Recuperar contraseña</h1>
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

          {error && <Notice tone="error" message={error} compact />}
          {success && <Notice tone="success" message={success} compact />}
          {deliveryHint && <Notice tone="info" message={deliveryHint} compact />}

          <button
            type="submit"
            disabled={loading}
            aria-disabled={loading}
            style={{ ...buttonStyle, ...getActionStateStyle(loading) }}
          >
            {loading ? "Enviando..." : "Enviar enlace"}
          </button>
        </form>

        <p style={{ color: "#6b7280", marginTop: 18 }}>
          <Link href="/login" style={appLinkStyle}>
            Volver al login
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
};

const subtitleStyle: React.CSSProperties = {
  ...appAuthSubtitleStyle,
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
