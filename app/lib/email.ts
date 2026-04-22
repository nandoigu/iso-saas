import { Resend } from "resend";
import {
  ComplianceReport,
  formatEmailDate,
  normalizeStatus,
} from "@/app/lib/alerts";

const STATUS_LABELS = {
  total: "Total",
  parcial: "Parcial",
  no_conforme: "No conforme",
};

type SendComplianceEmailInput = {
  to: string;
  userName: string | null;
  subject: string;
  report: ComplianceReport;
};

export async function sendComplianceEmail({
  to,
  userName,
  subject,
  report,
}: SendComplianceEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "BMO ISO 19650 <onboarding@resend.dev>";

  if (!apiKey) {
    return {
      sent: false,
      skipped: true,
      reason: "RESEND_API_KEY no esta configurada",
    };
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to,
    subject,
    html: buildComplianceEmailHtml({ userName, report }),
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return {
    sent: true,
    skipped: false,
    id: result.data?.id,
  };
}

function buildComplianceEmailHtml({
  userName,
  report,
}: {
  userName: string | null;
  report: ComplianceReport;
}) {
  const generatedAt = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());
  const rows = [...report.overdueRequirements, ...report.upcomingRequirements].slice(0, 40);

  return `
    <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
      <div style="max-width:920px;margin:0 auto;background:white;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:#0f172a;color:white;padding:20px 24px">
          <h1 style="margin:0;font-size:22px">Informe de Cumplimiento ISO 19650</h1>
          <p style="margin:8px 0 0;color:#cbd5e1">Generado: ${escapeHtml(generatedAt)}</p>
        </div>
        <div style="padding:24px">
          <p style="margin:0 0 18px">Hola ${escapeHtml(userName || "usuario")}, este es el resumen de cumplimiento de tus proyectos.</p>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px">
            ${summaryCard("Cumplimiento", `${report.metrics.compliance}%`)}
            ${summaryCard("Requerimientos", String(report.metrics.totalRequirements))}
            ${summaryCard("Vencidos", String(report.metrics.overdue), "#dc2626")}
            ${summaryCard("Proximos", String(report.metrics.upcoming), "#d97706")}
          </div>
          <h2 style="font-size:16px;margin:0 0 12px">Requerimientos vencidos o proximos a vencer</h2>
          ${buildRequirementsTable(rows)}
          <p style="font-size:12px;color:#64748b;margin-top:20px">Generado por BMO ISO 19650 SaaS.</p>
        </div>
      </div>
    </div>
  `;
}

function summaryCard(label: string, value: string, color = "#0f172a") {
  return `
    <div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#f8fafc">
      <div style="font-size:12px;color:#64748b">${escapeHtml(label)}</div>
      <div style="font-size:24px;font-weight:700;color:${color};margin-top:6px">${escapeHtml(value)}</div>
    </div>
  `;
}

function buildRequirementsTable(rows: ComplianceReport["requirements"]) {
  if (rows.length === 0) {
    return `<p style="color:#16a34a;font-weight:700">No hay requerimientos vencidos ni proximos a vencer.</p>`;
  }

  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:#0f172a;color:white">
          <th style="${thStyle}">Proyecto</th>
          <th style="${thStyle}">Norma</th>
          <th style="${thStyle}">Item</th>
          <th style="${thStyle}">Estado</th>
          <th style="${thStyle}">Fecha limite</th>
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
                <td style="${tdStyle};font-weight:700">${escapeHtml(STATUS_LABELS[status])}</td>
                <td style="${tdStyle}">${escapeHtml(formatEmailDate(requirement.deadline))}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const thStyle = "padding:10px;border:1px solid #e2e8f0;text-align:left";
const tdStyle = "padding:10px;border:1px solid #e2e8f0;vertical-align:top";
