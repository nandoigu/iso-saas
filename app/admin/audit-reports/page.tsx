import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  isAdminRole,
  isBlockedStatus,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/app/lib/auth";
import AuditReportsClient from "./AuditReportsClient";

export default async function AuditReportsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);

  if (!session) redirect("/login?next=/admin/audit-reports");
  if (isBlockedStatus(session.status)) redirect("/login");
  if (!isAdminRole(session.role)) redirect("/dashboard");

  return <AuditReportsClient />;
}
