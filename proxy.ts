import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "bmo_session";
const protectedRoutes = ["/", "/dashboard", "/projects", "/matrix", "/admin", "/account", "/profile"];
const authRoutes = ["/login", "/register"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSessionCookie = Boolean(req.cookies.get(SESSION_COOKIE_NAME)?.value);

  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtectedRoute && !hasSessionCookie) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (authRoutes.includes(pathname) && hasSessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/projects/:path*",
    "/matrix/:path*",
    "/admin/:path*",
    "/account/:path*",
    "/profile/:path*",
    "/login",
    "/register",
  ],
};
