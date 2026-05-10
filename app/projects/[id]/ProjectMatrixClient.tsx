"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ComplianceMatrix from "@/components/ComplianceMatrix";
import { useProjectRequirements } from "@/app/projects/[id]/useProjectRequirements";

type ProjectMatrixClientProps = {
  projectId: string;
};

export default function ProjectMatrixClient({
  projectId,
}: ProjectMatrixClientProps) {
  const isMobile = useMatrixPageBreakpoint() === "mobile";
  const { requirements, loading, loadError } = useProjectRequirements(projectId);

  return (
    <main style={{ padding: isMobile ? "20px 12px 32px" : 40 }}>
      <header
        style={{
          alignItems: "flex-start",
          display: isMobile ? "grid" : "flex",
          flexWrap: "wrap",
          gap: 16,
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Matriz de cumplimiento</h1>
          <p style={{ color: "#6b7280", margin: "8px 0 0" }}>
            Vista agrupada por norma e item para analizar el estado de cumplimiento
            del proyecto.
          </p>
        </div>

        <Link
          href={`/projects/${projectId}`}
          style={{
            ...secondaryLinkStyle,
            justifyContent: isMobile ? "center" : undefined,
            width: isMobile ? "100%" : undefined,
          }}
        >
          Volver al proyecto
        </Link>
      </header>

      {loading && (
        <EmptyState
          title="Cargando matriz"
          description="Obteniendo requerimientos del proyecto."
        />
      )}

      {!loading && loadError && (
        <EmptyState title="Error de carga" description={loadError} tone="risk" />
      )}

      {!loading && !loadError && <ComplianceMatrix requirements={requirements} />}
    </main>
  );
}

function useMatrixPageBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<"mobile" | "desktop">("desktop");

  useEffect(() => {
    const updateBreakpoint = () => {
      setBreakpoint(window.innerWidth < 760 ? "mobile" : "desktop");
    };

    updateBreakpoint();
    window.addEventListener("resize", updateBreakpoint);

    return () => {
      window.removeEventListener("resize", updateBreakpoint);
    };
  }, []);

  return breakpoint;
}

function EmptyState({
  title,
  description,
  tone = "default",
}: {
  title: string;
  description: string;
  tone?: "default" | "risk";
}) {
  return (
    <div
      style={{
        background: tone === "risk" ? "#fef2f2" : "white",
        border: `1px dashed ${tone === "risk" ? "#fca5a5" : "#d1d5db"}`,
        borderRadius: 12,
        color: tone === "risk" ? "#991b1b" : "#6b7280",
        padding: 24,
        textAlign: "center",
      }}
    >
      <strong style={{ color: tone === "risk" ? "#991b1b" : "#374151" }}>
        {title}
      </strong>
      <p style={{ margin: "6px 0 0" }}>{description}</p>
    </div>
  );
}

const secondaryLinkStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  color: "#111827",
  fontWeight: 700,
  minHeight: 40,
  padding: "9px 14px",
  textDecoration: "none",
};
