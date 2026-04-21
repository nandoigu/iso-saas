"use client";

import { useRouter } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      
      {/* SIDEBAR */}
      <aside
        style={{
          width: 240,
          background: "#111",
          color: "white",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <h2 style={{ marginBottom: 20 }}>BMO</h2>

        <button
          onClick={() => router.push("/dashboard")}
          style={btnStyle}
        >
          📊 Dashboard
        </button>

        <button
          onClick={() => router.push("/")}
          style={btnStyle}
        >
          🏠 Inicio
        </button>

        <button style={btnStyle}>
          📁 Proyectos
        </button>

        <button style={btnStyle}>
          ⚙️ Ajustes
        </button>
      </aside>

      {/* CONTENIDO */}
      <main
        style={{
          flex: 1,
          padding: 40,
          background: "#f7f9fc",
        }}
      >
        {children}
      </main>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "white",
  textAlign: "left",
  padding: "10px 0",
  cursor: "pointer",
  fontSize: 14,
};