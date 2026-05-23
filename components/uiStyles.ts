import type { CSSProperties } from "react";

export const appPanelStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe3f1",
  borderRadius: 8,
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
  minWidth: 0,
};

export const appPageStyle: CSSProperties = {
  background: "#f4f6fc",
  minHeight: "calc(100vh - 65px)",
  padding: "28px clamp(20px, 3vw, 36px) 40px",
};

export const appHeroStyle: CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  flexWrap: "wrap",
  gap: 20,
  justifyContent: "space-between",
  margin: "0 auto 24px",
  maxWidth: 1360,
};

export const appHeroCopyStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  minWidth: 0,
};

export const appHeroEyebrowStyle: CSSProperties = {
  color: "#0025df",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: "uppercase",
};

export const appHeroTitleStyle: CSSProperties = {
  color: "#002a4e",
  fontSize: 34,
  lineHeight: 1.1,
  margin: 0,
};

export const appHeroDescriptionStyle: CSSProperties = {
  color: "#5b6b82",
  fontSize: 16,
  lineHeight: 1.55,
  margin: 0,
  maxWidth: 720,
};

export const appHeroActionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
};

export const appAuthPageStyle: CSSProperties = {
  alignItems: "center",
  background: "#f4f6fc",
  display: "grid",
  minHeight: "calc(100vh - 70px)",
  padding: "28px 12px",
};

export const appAuthCardStyle: CSSProperties = {
  ...appPanelStyle,
  boxSizing: "border-box",
  margin: "0 auto",
  maxWidth: 460,
  padding: "clamp(20px, 4vw, 28px)",
  width: "100%",
};

export const appAuthTitleStyle: CSSProperties = {
  color: "#002a4e",
  fontSize: 28,
  lineHeight: 1.15,
  margin: 0,
};

export const appAuthSubtitleStyle: CSSProperties = {
  color: "#5b6b82",
  lineHeight: 1.5,
  margin: "8px 0 24px",
};

export const appFormLabelStyle: CSSProperties = {
  color: "#1e293b",
  display: "grid",
  fontSize: 14,
  fontWeight: 700,
  gap: 6,
};

export const appFieldStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  boxSizing: "border-box",
  minHeight: 42,
  minWidth: 0,
  padding: "8px 10px",
  width: "100%",
};

export const appPrimaryButtonStyle: CSSProperties = {
  background: "#0025df",
  border: "1px solid #0025df",
  borderRadius: 8,
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 700,
  minHeight: 40,
  padding: "9px 14px",
};

export const appFullWidthPrimaryButtonStyle: CSSProperties = {
  ...appPrimaryButtonStyle,
  minHeight: 42,
  padding: "0 14px",
  width: "100%",
};

export const appSecondaryButtonStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  color: "#0f172a",
  cursor: "pointer",
  fontWeight: 700,
  minHeight: 40,
  padding: "9px 14px",
};

export const appLinkStyle: CSSProperties = {
  color: "#0025df",
  fontWeight: 700,
  textDecoration: "none",
};

export const appDangerButtonStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #fecaca",
  borderRadius: 8,
  color: "#b91c1c",
  cursor: "pointer",
  fontWeight: 700,
  minHeight: 40,
  padding: "9px 14px",
};

export function getActionStateStyle(disabled: boolean): CSSProperties {
  return {
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

export const appEmptyStateStyle: CSSProperties = {
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  borderRadius: 8,
  color: "#64748b",
  padding: 22,
  textAlign: "center",
};

export const appHelpPanelStyle: CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #dbe3f1",
  borderRadius: 8,
  color: "#334155",
};

export const appBadgeBaseStyle: CSSProperties = {
  borderRadius: 999,
  display: "inline-flex",
  fontSize: 12,
  fontWeight: 800,
  padding: "6px 10px",
  whiteSpace: "nowrap",
};

export const appTableStyle: CSSProperties = {
  borderCollapse: "collapse",
  width: "100%",
};

export const appTableHeaderStyle: CSSProperties = {
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: 13,
  fontWeight: 700,
  padding: "12px 14px",
  textAlign: "left",
};

export const appTableCellStyle: CSSProperties = {
  borderBottom: "1px solid #e2e8f0",
  color: "#0f172a",
  fontSize: 14,
  padding: "14px",
  verticalAlign: "top",
};

export function getUserRoleBadgeStyle(role: string): CSSProperties {
  return {
    ...appBadgeBaseStyle,
    background: role === "admin" ? "#dbeafe" : "#eef2ff",
    border: `1px solid ${role === "admin" ? "#93c5fd" : "#c7d2fe"}`,
    color: role === "admin" ? "#1d4ed8" : "#4338ca",
  };
}

export function getUserStatusBadgeStyle(status: string): CSSProperties {
  const map = {
    active: { background: "#f0fdf4", border: "#bbf7d0", color: "#166534" },
    suspended: { background: "#fff7ed", border: "#fdba74", color: "#c2410c" },
    blocked: { background: "#fef2f2", border: "#fecaca", color: "#b91c1c" },
  } as const;

  const current = map[status as keyof typeof map] || map.active;

  return {
    ...appBadgeBaseStyle,
    background: current.background,
    border: `1px solid ${current.border}`,
    color: current.color,
  };
}
