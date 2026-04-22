import { NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/app/lib/auth";

export async function GET(req: Request) {
  const user = await getAuthSession(req);

  if (!user) {
    return unauthorized();
  }

  return NextResponse.json({ data: { user } });
}
