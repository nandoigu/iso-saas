"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main style={pageStyle}>Cargando...</main>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

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

    if (!token) {
      setError("Falta el token de restablecimiento.");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudo restablecer la contraseña.");
        return;
      }

      setSuccess("Contrasena actualizada correctamente. Redirigiendo al login...");
      setTimeout(() => {
        router.push("/login");
      }, 1200);
    } catch {
      setError("No se pudo restablecer la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <h1 style={appAuthTitleStyle}>Nueva contraseña</h1>
        <p style={subtitleStyle}>
          Define una nueva contraseña segura para recuperar el acceso a tu cuenta.
        </p>

        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          <label style={labelStyle}>
            Nueva contraseña
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
            Confirmar contraseña
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
              style={inputStyle}
            />
          </label>

          {error && <Notice tone="error" message={error} compact />}
          {success && <Notice tone="success" message={success} compact />}

          <button
            type="submit"
            disabled={loading}
            aria-disabled={loading}
            style={{ ...buttonStyle, ...getActionStateStyle(loading) }}
          >
            {loading ? "Actualizando..." : "Guardar nueva contraseña"}
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
