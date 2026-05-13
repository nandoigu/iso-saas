import type { CSSProperties, ReactNode } from "react";
import { appEmptyStateStyle } from "@/components/uiStyles";

export function EmptyState({
  title,
  description,
  action,
  tone = "default",
  style,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  tone?: "default" | "risk";
  style?: CSSProperties;
}) {
  const isRisk = tone === "risk";

  return (
    <div
      role={isRisk ? "alert" : "status"}
      aria-live={isRisk ? "assertive" : "polite"}
      style={{
        ...appEmptyStateStyle,
        background: isRisk ? "#fef2f2" : appEmptyStateStyle.background,
        border: `1px dashed ${isRisk ? "#fca5a5" : "#cbd5e1"}`,
        color: isRisk ? "#991b1b" : appEmptyStateStyle.color,
        ...style,
      }}
    >
      <strong style={{ color: isRisk ? "#991b1b" : "#334155" }}>{title}</strong>
      <p style={{ margin: "6px 0 0" }}>{description}</p>
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
    </div>
  );
}
