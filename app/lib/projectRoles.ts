export const PROJECT_ROLE_VALUES = [
  "adjudicador",
  "adjudicatario_principal",
  "adjudicatario",
] as const;

export type ProjectRole = (typeof PROJECT_ROLE_VALUES)[number];

export const DEFAULT_PROJECT_ROLE: ProjectRole = "adjudicatario";

export function isProjectRole(value: unknown): value is ProjectRole {
  return PROJECT_ROLE_VALUES.includes(value as ProjectRole);
}

export function getProjectRoleLabel(role: string | null | undefined) {
  if (role === "adjudicador") return "Adjudicador";
  if (role === "adjudicatario_principal") return "Adjudicatario principal";
  return "Adjudicatario";
}

export function getProjectRoleBadgeStyle(
  role: string | null | undefined
): React.CSSProperties {
  if (role === "adjudicador") {
    return {
      background: "#eff6ff",
      border: "1px solid #bfdbfe",
      color: "#1d4ed8",
    };
  }

  if (role === "adjudicatario_principal") {
    return {
      background: "#eef2ff",
      border: "1px solid #c7d2fe",
      color: "#4338ca",
    };
  }

  return {
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    color: "#166534",
  };
}
