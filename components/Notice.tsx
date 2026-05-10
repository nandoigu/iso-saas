import type { CSSProperties } from "react";

export type NoticeTone = "success" | "error" | "info" | "warning";

export function Notice({
  tone,
  message,
  compact = false,
  style,
}: {
  tone: NoticeTone;
  message: string;
  compact?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        ...getNoticeToneStyle(tone),
        borderRadius: compact ? 8 : 10,
        fontSize: compact ? 13 : 14,
        fontWeight: 700,
        margin: 0,
        padding: compact ? 10 : 12,
        ...style,
      }}
    >
      {message}
    </div>
  );
}

function getNoticeToneStyle(tone: NoticeTone): CSSProperties {
  if (tone === "success") {
    return {
      background: "#f0fdf4",
      border: "1px solid #bbf7d0",
      color: "#166534",
    };
  }

  if (tone === "info") {
    return {
      background: "#eff6ff",
      border: "1px solid #bfdbfe",
      color: "#1d4ed8",
    };
  }

  if (tone === "warning") {
    return {
      background: "#fff7ed",
      border: "1px solid #fdba74",
      color: "#c2410c",
    };
  }

  return {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
  };
}
