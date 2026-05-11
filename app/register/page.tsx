"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Notice } from "@/components/Notice";

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
        <h1 style={{ margin: 0 }}>Crear cuenta</h1>
        <p style={{ color: "#6b7280", margin: "8px 0 24px" }}>
          Crea tu espacio privado para gestionar cumplimiento ISO 19650.
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
            Contrasena
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

          <button type="submit" disabled={loading} style={buttonStyle}>
            {loading ? "Creando..." : "Crear cuenta"}
          </button>
        </form>

        <p style={{ color: "#6b7280", marginTop: 18 }}>
          Ya tienes cuenta?{" "}
          <Link href="/login" style={{ color: "#2563eb", fontWeight: 700 }}>
            Entrar
          </Link>
        </p>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  display: "grid",
  minHeight: "calc(100vh - 65px)",
  placeItems: "center",
  padding: "20px 12px",
};

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  boxSizing: "border-box",
  boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
  maxWidth: 440,
  padding: "clamp(20px, 4vw, 28px)",
  width: "100%",
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
  boxSizing: "border-box",
  minHeight: 42,
  minWidth: 0,
  padding: "8px 10px",
  width: "100%",
};

const buttonStyle: React.CSSProperties = {
  background: "#2563eb",
  border: "1px solid #2563eb",
  borderRadius: 8,
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
  minHeight: 42,
  width: "100%",
};
