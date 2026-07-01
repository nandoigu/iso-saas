import { createSessionToken, SESSION_COOKIE_NAME } from "@/app/lib/auth";
import type { AuthUser } from "@/app/lib/auth";

export function sessionCookie(user: AuthUser): string {
  const token = createSessionToken(user);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

export function makeRequest(
  url: string,
  options: {
    method?: string;
    cookie?: string;
    body?: unknown;
  } = {}
): Request {
  return new Request(`http://localhost${url}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
}
