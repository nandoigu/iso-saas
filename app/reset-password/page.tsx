"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { Notice } from "@/components/Notice";

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
      setError("Las contrasenas no coinciden.");
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
        setError(data.error || "No se pudo restablecer la contrasena.");
        return;
      }

      setSuccess("Contrasena actualizada correctamente. Redirigiendo al login...");
      setTimeout(() => {
        router.push("/login");
      }, 1200);
    } catch {
      setError("No se pudo restablecer la contrasena.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <h1 style={{ margin: 0 }}>Nueva contrasena</h1>
        <p style={subtitleStyle}>
          Define una nueva contrasena segura para recuperar el acceso a tu cuenta.
        </p>

        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
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
            Confirmar contrasena
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

          <button type="submit" disabled={loading} style={buttonStyle}>
            {loading ? "Actualizando..." : "Guardar nueva contrasena"}
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
