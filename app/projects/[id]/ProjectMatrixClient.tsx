"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ComplianceMatrix from "@/components/ComplianceMatrix";
import { EmptyState } from "@/components/EmptyState";
import {
  appHeroCopyStyle,
  appHeroDescriptionStyle,
  appHeroEyebrowStyle,
  appHeroStyle,
  appHeroTitleStyle,
  appPageStyle,
  appSecondaryButtonStyle,
} from "@/components/uiStyles";
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
    <main style={{ ...appPageStyle, ...(isMobile ? mobilePageStyle : {}) }}>
      <section
        style={{
          ...appHeroStyle,
          alignItems: "flex-start",
          display: isMobile ? "grid" : "flex",
        }}
      >
        <div style={appHeroCopyStyle}>
          <span style={appHeroEyebrowStyle}>Workspace de requerimientos</span>
          <h1 style={appHeroTitleStyle}>Matriz de cumplimiento</h1>
          <p style={appHeroDescriptionStyle}>
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
      </section>

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

const secondaryLinkStyle: React.CSSProperties = {
  ...appSecondaryButtonStyle,
  display: "inline-flex",
  minHeight: 40,
  padding: "9px 14px",
  textDecoration: "none",
};

const mobilePageStyle: React.CSSProperties = {
  padding: "20px 12px 32px",
};
