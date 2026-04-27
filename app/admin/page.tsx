import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminPanelClient from "./AdminPanelClient";
import {
  getSessionUserFromToken,
  isAdminRole,
  isBlockedStatus,
  SESSION_COOKIE_NAME,
} from "@/app/lib/auth";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = await getSessionUserFromToken(token);

  if (!user) {
    redirect("/login?next=/admin");
  }

  if (isBlockedStatus(user.status)) {
    redirect("/login");
  }

  if (!isAdminRole(user.role)) {
    redirect("/dashboard");
  }

  return <AdminPanelClient currentUserEmail={user.email} currentUserId={user.id} />;
}
