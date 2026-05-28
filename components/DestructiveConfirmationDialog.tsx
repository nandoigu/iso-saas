"use client";

import { useEffect } from "react";
import {
  appDangerButtonStyle,
  appSecondaryButtonStyle,
} from "@/components/uiStyles";

export type DestructiveConfirmationState = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
};

export function DestructiveConfirmationDialog({
  confirmation,
  onCancel,
}: {
  confirmation: DestructiveConfirmationState | null;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!confirmation) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmation, onCancel]);

  if (!confirmation) return null;

  return (
    <div
      role="presentation"
      style={overlayStyle}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="destructive-confirmation-title"
        style={dialogStyle}
      >
        <div style={warningMarkStyle}>!</div>
        <div>
          <h2 id="destructive-confirmation-title" style={titleStyle}>
            {confirmation.title}
          </h2>
          <p style={messageStyle}>{confirmation.message}</p>
        </div>

        <div style={actionsStyle}>
          <button
            type="button"
            onClick={onCancel}
            style={secondaryButtonStyle}
            autoFocus
          >
            {confirmation.cancelLabel || "Cancelar"}
          </button>
          <button
            type="button"
            onClick={() => {
              confirmation.onConfirm();
              onCancel();
            }}
            style={dangerButtonStyle}
          >
            {confirmation.confirmLabel || "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  alignItems: "center",
  background: "rgba(15, 23, 42, 0.48)",
  display: "flex",
  inset: 0,
  justifyContent: "center",
  padding: 18,
  position: "fixed",
  zIndex: 50,
};

const dialogStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #fecaca",
  borderRadius: 8,
  boxShadow: "0 18px 44px rgba(15, 23, 42, 0.16)",
  display: "grid",
  gap: 14,
  maxWidth: 460,
  padding: 18,
  width: "100%",
};

const warningMarkStyle: React.CSSProperties = {
  alignItems: "center",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: 999,
  color: "#b91c1c",
  display: "inline-flex",
  fontWeight: 700,
  height: 34,
  justifyContent: "center",
  width: 34,
};

const titleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 500,
  lineHeight: 1.25,
  margin: 0,
};

const messageStyle: React.CSSProperties = {
  color: "#475569",
  lineHeight: 1.55,
  margin: "8px 0 0",
  whiteSpace: "pre-line",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  justifyContent: "flex-end",
  marginTop: 4,
};

const secondaryButtonStyle: React.CSSProperties = {
  ...appSecondaryButtonStyle,
};

const dangerButtonStyle: React.CSSProperties = {
  ...appDangerButtonStyle,
  background: "#b91c1c",
  borderColor: "#b91c1c",
  color: "#ffffff",
};
