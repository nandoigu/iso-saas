"use client";

import { FormEvent, useEffect, useState } from "react";
import { Notice } from "@/components/Notice";

type AuthMeResponse = {
  data?: {
    user?: {
      email?: string;
      name?: string | null;
    };
  };
};

export default function EmailTestPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AuthMeResponse | null) => {
        if (data?.data?.user?.email) {
          setEmail(data.data.user.email);
        }
      })
      .catch((err) => {
        console.error("Error cargando usuario:", err);
      })
      .finally(() => {
        setHydrating(false);
      });
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/email/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to: email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo enviar el email de prueba.");
      }

      setSuccess(`Email enviado correctamente a ${data.data.to}.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo enviar el email de prueba."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ display: "grid", gap: 24 }}>
      <section
        style={{
          background: "white",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
          margin: "0 auto",
          maxWidth: 640,
          padding: 28,
          width: "100%",
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>Prueba de email con Resend</h1>
          <p style={{ color: "#64748b", lineHeight: 1.7, margin: "10px 0 0" }}>
            Este formulario envia un correo HTML real desde el servidor usando la
            configuracion actual de Resend.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <label
            style={{
              color: "#334155",
              display: "grid",
              fontSize: 14,
              fontWeight: 700,
              gap: 8,
            }}
          >
            Email destinatario
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@email.com"
              autoComplete="email"
              disabled={loading || hydrating}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 12,
                fontSize: 15,
                minHeight: 46,
                padding: "10px 12px",
              }}
            />
          </label>

          <button
            type="submit"
            disabled={loading || hydrating || !email.trim()}
            style={{
              background: "#2563eb",
              border: "1px solid #2563eb",
              borderRadius: 12,
              color: "white",
              cursor:
                loading || hydrating || !email.trim() ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: 700,
              minHeight: 46,
              opacity: loading || hydrating || !email.trim() ? 0.6 : 1,
              padding: "0 16px",
            }}
          >
            {loading ? "Enviando..." : "Enviar email de prueba"}
          </button>
        </form>

        {success && (
          <Notice tone="success" message={success} style={{ marginTop: 16 }} />
        )}

        {error && <Notice tone="error" message={error} style={{ marginTop: 16 }} />}

        <div
          style={{
            borderTop: "1px solid #e2e8f0",
            color: "#64748b",
            fontSize: 13,
            lineHeight: 1.7,
            marginTop: 20,
            paddingTop: 16,
          }}
        >
          <div>
            El envio se ejecuta solo en servidor y utiliza las variables
            <code> RESEND_API_KEY </code>
            y
            <code> EMAIL_FROM </code>.
          </div>
          <div style={{ marginTop: 6 }}>
            Si el dominio aun no esta verificado, puedes usar un remitente de
            pruebas como
            <code> BMO ISO 19650 &lt;onboarding@resend.dev&gt; </code>.
          </div>
        </div>
      </section>
    </main>
  );
}
