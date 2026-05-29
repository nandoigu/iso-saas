import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getSessionUserFromToken,
  isAdminRole,
  isBlockedStatus,
  SESSION_COOKIE_NAME,
} from "@/app/lib/auth";
import AuditReportsClient from "./AuditReportsClient";

export default async function AuditReportsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = await getSessionUserFromToken(token);

  if (!user) redirect("/login?next=/admin/audit-reports");
  if (isBlockedStatus(user.status)) redirect("/login");
  if (!isAdminRole(user.role)) redirect("/dashboard");

  return <AuditReportsClient />;
}
