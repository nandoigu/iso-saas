import { NextResponse } from "next/server";
import {
  forbidden,
  getAuthSession,
  isBlockedStatus,
  isSuspendedStatus,
  unauthorized,
} from "@/app/lib/auth";

export async function GET(req: Request) {
  const user = await getAuthSession(req, { allowBlocked: true });

  if (!user) {
    return unauthorized();
  }

  if (isBlockedStatus(user.status)) {
    return forbidden("Tu cuenta esta bloqueada. Contacta con el administrador.");
  }

  return NextResponse.json({
    data: {
      user,
      warning: isSuspendedStatus(user.status)
        ? "Tu cuenta esta suspendida. Algunas funciones pueden estar limitadas."
        : null,
    },
  });
}
