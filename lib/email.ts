import "server-only";
import { getEmailFromAddress, getResendClient } from "@/lib/resend";
import type { ComplianceReport } from "@/app/lib/alerts";
import { formatEmailDate, normalizeStatus } from "@/app/lib/alerts";

const STATUS_LABELS = {
  total: "Total",
  parcial: "Parcial",
  no_conforme: "No conforme",
};

type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
};

type BaseTemplateInput = {
  previewText?: string;
  title: string;
  subtitle?: string;
  bodyHtml: string;
  footerText?: string;
};

type SendTestEmailInput = {
  to: string;
  recipientName?: string | null;
};

type SendComplianceEmailInput = {
  to: string;
  userName: string | null;
  subject: string;
  report: ComplianceReport;
  deliveryMode?: "manual" | "cron";
};

type AlertDigestItem = {
  id: string;
  projectName: string;
  norma: string | null;
  item: string | null;
  name: string;
  status: string;
  deadline: Date | string | null;
};

type SendAlertDigestEmailInput = {
  to: string;
  userName: string | null;
  overdueRequirements: AlertDigestItem[];
  upcomingRequirements: AlertDigestItem[];
  deliveryMode?: "manual" | "cron";
};

type SendPasswordResetEmailInput = {
  to: string;
  userName: string | null;
  resetUrl: string;
};

export type EmailFailureKind =
  | "configuration"
  | "provider_restriction"
  | "provider"
  | "unknown";

export class EmailDeliveryError extends Error {
  kind: EmailFailureKind;

  constructor(message: string, kind: EmailFailureKind = "unknown") {
    super(message);
    this.name = "EmailDeliveryError";
    this.kind = kind;
  }
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
  tags,
}: SendEmailInput) {
  const resend = getResendClient();
  const from = getEmailFromAddress();

  const result = await resend.emails.send({
    from,
    to,
    subject,
    html,
    text: text ?? htmlToText(html),
    ...(replyTo ? { replyTo } : {}),
    ...(tags ? { tags } : {}),
  });

  if (result.error) {
    throw classifyEmailError(result.error.message || "RESEND_SEND_FAILED");
  }

  return {
    id: result.data?.id ?? null,
  };
}

export async function sendTestEmail({
  to,
  recipientName,
}: SendTestEmailInput) {
  const template = getTestEmailTemplate({ recipientName });

  return sendEmail({
    to,
    subject: "Prueba de email de BMO ISO 19650",
    html: template.html,
    text: template.text,
    tags: [
      { name: "category", value: "test_email" },
      { name: "source", value: "dashboard" },
    ],
  });
}

export async function sendComplianceEmail({
  to,
  userName,
  subject,
  report,
  deliveryMode = "cron",
}: SendComplianceEmailInput) {
  const html = getComplianceEmailHtml({ userName, report, deliveryMode });
  const text = getComplianceEmailText({ userName, report, deliveryMode });

  return sendEmail({
    to,
    subject,
    html,
    text,
    tags: [
      { name: "category", value: "compliance_report" },
      { name: "type", value: deliveryMode },
    ],
  });
}

export async function sendAlertDigestEmail({
  to,
  userName,
  overdueRequirements,
  upcomingRequirements,
  deliveryMode = "cron",
}: SendAlertDigestEmailInput) {
  const template = getAlertDigestEmailTemplate({
    userName,
    overdueRequirements,
    upcomingRequirements,
    deliveryMode,
  });

  return sendEmail({
    to,
    subject: `Alertas ISO 19650: ${overdueRequirements.length} vencidos, ${upcomingRequirements.length} próximos`,
    html: template.html,
    text: template.text,
    tags: [
      { name: "category", value: "compliance_alerts" },
      { name: "type", value: deliveryMode },
    ],
  });
}

export async function sendPasswordResetEmail({
  to,
  userName,
  resetUrl,
}: SendPasswordResetEmailInput) {
  const template = getPasswordResetEmailTemplate({
    userName,
    resetUrl,
  });

  return sendEmail({
    to,
    subject: "Restablece tu contrasena en BMO ISO 19650",
    html: template.html,
    text: template.text,
    tags: [
      { name: "category", value: "password_reset" },
      { name: "type", value: "auth" },
    ],
  });
}

export function getBaseEmailTemplate({
  previewText,
  title,
  subtitle,
  bodyHtml,
  footerText = "Generado por BMO ISO 19650 SaaS.",
}: BaseTemplateInput) {
  const html = `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(title)}</title>
      </head>
      <body style="margin:0;background:#f8fafc;color:#0f172a;font-family:Arial,Helvetica,sans-serif;">
        ${
          previewText
            ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(
                previewText
              )}</div>`
            : ""
        }
        <div style="padding:32px 16px;">
          <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
            <div style="background:#0f172a;padding:24px 28px;color:#ffffff;">
              <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#cbd5e1;">BMO ISO 19650</div>
              <h1 style="margin:10px 0 0;font-size:24px;line-height:1.3;">${escapeHtml(title)}</h1>
              ${
                subtitle
                  ? `<p style="margin:10px 0 0;color:#cbd5e1;font-size:14px;line-height:1.6;">${escapeHtml(
                      subtitle
                    )}</p>`
                  : ""
              }
            </div>
            <div style="padding:28px;">
              ${bodyHtml}
            </div>
            <div style="border-top:1px solid #e2e8f0;padding:18px 28px;color:#64748b;font-size:12px;line-height:1.6;">
              ${escapeHtml(footerText)}
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  return {
    html,
    text: htmlToText(html),
  };
}

export function getTestEmailTemplate({
  recipientName,
}: {
  recipientName?: string | null;
}) {
  const generatedAt = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  return getBaseEmailTemplate({
    previewText: "Tu integracion de correo con Resend ya esta operativa.",
    title: "Prueba de envio completada",
    subtitle:
      "Este email confirma que la integracion de Resend esta funcionando correctamente en tu aplicacion SaaS.",
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">
        Hola ${escapeHtml(recipientName || "equipo")},
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">
        Hemos enviado este correo como verificacion del entorno de email de <strong>BMO ISO 19650</strong>.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px;margin:20px 0;">
        <div style="font-size:13px;color:#64748b;margin-bottom:8px;">Detalle de la prueba</div>
        <div style="font-size:14px;line-height:1.8;">
          <div><strong>Estado:</strong> Envio correcto</div>
          <div><strong>Fecha:</strong> ${escapeHtml(generatedAt)}</div>
          <div><strong>Canal:</strong> Resend + Next.js App Router</div>
        </div>
      </div>
      <p style="margin:0;font-size:15px;line-height:1.7;">
        La base ya esta preparada para emails transaccionales, alertas de vencimiento, informes automaticos y otros flujos internos.
      </p>
    `,
  });
}

export function getComplianceEmailHtml({
  userName,
  report,
  deliveryMode,
}: {
  userName: string | null;
  report: ComplianceReport;
  deliveryMode: "manual" | "cron";
}) {
  const generatedAt = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());
  const rows = [...report.overdueRequirements, ...report.upcomingRequirements].slice(0, 40);

  return getBaseEmailTemplate({
    previewText: "Resumen de cumplimiento y alertas de vencimiento.",
    title: "Informe de Cumplimiento ISO 19650",
    subtitle: `${deliveryMode === "manual" ? "Informe manual" : "Informe automático"} generado el ${generatedAt}`,
    bodyHtml: `
      <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">
        Hola ${escapeHtml(userName || "usuario")}, este es el resumen actualizado del estado de cumplimiento de tus proyectos. Incluye los datos actuales del dashboard y las alertas operativas más relevantes.
      </p>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:22px;">
        ${summaryCard("Cumplimiento", `${report.metrics.compliance}%`)}
        ${summaryCard("Requerimientos", String(report.metrics.totalRequirements))}
        ${summaryCard("Vencidos", String(report.metrics.overdue), "#dc2626")}
        ${summaryCard("Próximos", String(report.metrics.upcoming), "#d97706")}
      </div>
      ${buildEmailCallout(report)}
      <h2 style="font-size:16px;margin:22px 0 12px;">Requerimientos vencidos o próximos a vencer</h2>
      ${buildRequirementsTable(rows)}
    `,
  }).html;
}

export function getAlertDigestEmailTemplate({
  userName,
  overdueRequirements,
  upcomingRequirements,
  deliveryMode,
}: {
  userName: string | null;
  overdueRequirements: AlertDigestItem[];
  upcomingRequirements: AlertDigestItem[];
  deliveryMode: "manual" | "cron";
}) {
  const generatedAt = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  return getBaseEmailTemplate({
    previewText:
      "Tienes requerimientos vencidos o próximos a vencer en tus proyectos.",
    title: "Alertas de cumplimiento ISO 19650",
    subtitle: `${deliveryMode === "manual" ? "Envío manual" : "Envío automático diario"} generado el ${generatedAt}`,
    bodyHtml: `
      <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">
        Hola ${escapeHtml(
          userName || "usuario"
        )}, te enviamos el resumen de alertas de vencimiento de tus requerimientos. Revisa primero los vencidos y después los próximos 7 días.
      </p>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:22px;">
        ${summaryCard("Vencidos", String(overdueRequirements.length), "#dc2626")}
        ${summaryCard("Próximos 7 días", String(upcomingRequirements.length), "#d97706")}
      </div>
      ${buildAlertSection("Vencidos", overdueRequirements, "#dc2626")}
      ${buildAlertSection("Próximos a vencer", upcomingRequirements, "#d97706")}
    `,
  });
}

export function getPasswordResetEmailTemplate({
  userName,
  resetUrl,
}: {
  userName: string | null;
  resetUrl: string;
}) {
  return getBaseEmailTemplate({
    previewText: "Has solicitado restablecer tu contrasena.",
    title: "Restablecimiento de contrasena",
    subtitle: "Este enlace caduca en 1 hora y solo puede usarse una vez.",
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">
        Hola ${escapeHtml(userName || "usuario")},
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">
        Hemos recibido una solicitud para restablecer la contrasena de tu cuenta en <strong>BMO ISO 19650</strong>.
      </p>
      <div style="margin:24px 0;">
        <a
          href="${escapeHtml(resetUrl)}"
          style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;"
        >
          Restablecer contrasena
        </a>
      </div>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#475569;">
        Si el boton no funciona, copia y pega este enlace en tu navegador:
      </p>
      <p style="margin:0;font-size:13px;line-height:1.7;word-break:break-all;color:#0f172a;">
        ${escapeHtml(resetUrl)}
      </p>
      <p style="margin:16px 0 0;font-size:14px;line-height:1.7;color:#475569;">
        Si no has solicitado este cambio, puedes ignorar este correo con tranquilidad.
      </p>
    `,
  });
}

function getComplianceEmailText({
  userName,
  report,
  deliveryMode,
}: {
  userName: string | null;
  report: ComplianceReport;
  deliveryMode: "manual" | "cron";
}) {
  const header = [
    "Informe de Cumplimiento ISO 19650",
    deliveryMode === "manual" ? "Envio manual" : "Envio automatico",
    `Hola ${userName || "usuario"}`,
    `Cumplimiento: ${report.metrics.compliance}%`,
    `Requerimientos: ${report.metrics.totalRequirements}`,
    `Vencidos: ${report.metrics.overdue}`,
    `Proximos: ${report.metrics.upcoming}`,
    "",
    "Requerimientos vencidos o proximos a vencer:",
  ];

  const rows = [...report.overdueRequirements, ...report.upcomingRequirements]
    .slice(0, 40)
    .map(
      (requirement) =>
        `- ${requirement.projectName} | ${requirement.norma || "Sin norma"} | ${
          requirement.item || "Sin item"
        } | ${STATUS_LABELS[normalizeStatus(requirement.status)]} | ${formatEmailDate(
          requirement.deadline
        )}`
    );

  return [...header, ...rows, "", "Generado por BMO ISO 19650 SaaS."].join("\n");
}

function buildEmailCallout(report: ComplianceReport) {
  if (report.metrics.overdue > 0) {
    return `
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;color:#991b1b;padding:14px 16px;font-size:14px;line-height:1.6;">
        Hay ${report.metrics.overdue} requerimientos vencidos. Prioriza su revisión y actualiza evidencia, estado o fecha límite desde el proyecto.
      </div>
    `;
  }

  if (report.metrics.upcoming > 0) {
    return `
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;color:#9a3412;padding:14px 16px;font-size:14px;line-height:1.6;">
        Hay ${report.metrics.upcoming} requerimientos próximos a vencer en los próximos 7 días.
      </div>
    `;
  }

  return `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;color:#166534;padding:14px 16px;font-size:14px;line-height:1.6;">
      No hay vencimientos activos en este momento.
    </div>
  `;
}

function summaryCard(label: string, value: string, color = "#0f172a") {
  return `
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#f8fafc;">
      <div style="font-size:12px;color:#64748b;margin-bottom:6px;">${escapeHtml(label)}</div>
      <div style="font-size:24px;font-weight:700;color:${color};">${escapeHtml(value)}</div>
    </div>
  `;
}

function buildRequirementsTable(rows: ComplianceReport["requirements"]) {
  if (rows.length === 0) {
    return `<p style="color:#16a34a;font-weight:700;margin:0;">No hay requerimientos vencidos ni próximos a vencer.</p>`;
  }

  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#0f172a;color:#ffffff;">
          <th style="${thStyle}">Proyecto</th>
          <th style="${thStyle}">Norma</th>
          <th style="${thStyle}">Item</th>
          <th style="${thStyle}">Estado</th>
          <th style="${thStyle}">Fecha límite</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((requirement) => {
            const status = normalizeStatus(requirement.status);

            return `
              <tr>
                <td style="${tdStyle}">${escapeHtml(requirement.projectName)}</td>
                <td style="${tdStyle}">${escapeHtml(requirement.norma || "Sin norma")}</td>
                <td style="${tdStyle}">${escapeHtml(requirement.item || "Sin item")}</td>
                <td style="${tdStyle};font-weight:700;">${escapeHtml(STATUS_LABELS[status])}</td>
                <td style="${tdStyle}">${escapeHtml(formatEmailDate(requirement.deadline))}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function buildAlertSection(title: string, rows: AlertDigestItem[], color: string) {
  if (rows.length === 0) {
    return `
      <div style="margin:18px 0 0;">
        <h2 style="font-size:16px;margin:0 0 10px;color:${color};">${escapeHtml(title)}</h2>
        <p style="margin:0;color:#64748b;">No hay elementos en esta sección.</p>
      </div>
    `;
  }

  return `
    <div style="margin:18px 0 0;">
      <h2 style="font-size:16px;margin:0 0 12px;color:${color};">${escapeHtml(title)}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#0f172a;color:#ffffff;">
            <th style="${thStyle}">Proyecto</th>
            <th style="${thStyle}">Norma</th>
            <th style="${thStyle}">Item</th>
            <th style="${thStyle}">Requerimiento</th>
            <th style="${thStyle}">Estado</th>
            <th style="${thStyle}">Fecha límite</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((requirement) => {
              const status = normalizeStatus(requirement.status);
              return `
                <tr>
                  <td style="${tdStyle}">${escapeHtml(requirement.projectName)}</td>
                  <td style="${tdStyle}">${escapeHtml(requirement.norma || "Sin norma")}</td>
                  <td style="${tdStyle}">${escapeHtml(requirement.item || "Sin item")}</td>
                  <td style="${tdStyle}">${escapeHtml(requirement.name)}</td>
                  <td style="${tdStyle};font-weight:700;">${escapeHtml(STATUS_LABELS[status])}</td>
                  <td style="${tdStyle}">${escapeHtml(formatEmailDate(requirement.deadline))}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const thStyle =
  "padding:10px;border:1px solid #e2e8f0;text-align:left;vertical-align:top;";
const tdStyle = "padding:10px;border:1px solid #e2e8f0;vertical-align:top;";

function classifyEmailError(message: string) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("resend_api_key_missing") ||
    normalized.includes("email_from_missing")
  ) {
    return new EmailDeliveryError(
      "Falta configurar el servicio de email en el entorno.",
      "configuration"
    );
  }

  if (
    normalized.includes("testing emails are only available") ||
    normalized.includes("verify a domain") ||
    normalized.includes("test emails") ||
    normalized.includes("recipient") && normalized.includes("not verified")
  ) {
    return new EmailDeliveryError(
      "El proveedor de email esta en modo de pruebas y no permite enviar a ese destinatario. Verifica el dominio remitente en Resend para habilitar envios reales.",
      "provider_restriction"
    );
  }

  if (normalized.includes("resend")) {
    return new EmailDeliveryError(
      "El proveedor de email rechazo el envio.",
      "provider"
    );
  }

  return new EmailDeliveryError(message, "unknown");
}
