"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

const BRAND = "#002a4e";
const ACTION = "#0025df";
const SURFACE = "#f4f6fc";

const navigationItems = [
  { href: "/projects", label: "Proyectos" },
  { href: "/matrix", label: "Matriz" },
  { href: "/dashboard", label: "Dashboard" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        setUser(data?.data?.user || null);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoadingUser(false);
      });
  }, [pathname]);

  const isAuthPage = pathname === "/login" || pathname === "/register";

  const visibleNavigation = useMemo(() => {
    if (!user) return [];

    const items = [...navigationItems];

    if (user.role === "admin") {
      items.push({ href: "/admin", label: "Admin" });
    }

    return items.map((item) => ({
      ...item,
      active: isRouteActive(pathname, item.href),
    }));
  }, [pathname, user]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
    router.refresh();
  };

  return (
    <header
      style={{
        background: "white",
        borderBottom: "1px solid #dbe3f1",
        boxShadow: "0 4px 16px rgba(0, 42, 78, 0.04)",
        minHeight: 70,
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "grid",
          gap: 16,
          gridTemplateColumns: user
            ? "minmax(180px, auto) minmax(0, 1fr) auto"
            : "minmax(180px, auto) auto",
          margin: "0 auto",
          maxWidth: 1440,
          minHeight: 70,
          padding: "0 28px",
        }}
      >
        <Link
          href={user ? "/dashboard" : "/login"}
          style={{
            alignItems: "center",
            color: BRAND,
            display: "inline-flex",
            gap: 12,
            minWidth: 0,
            textDecoration: "none",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              alignItems: "center",
              background: SURFACE,
              border: `1px solid ${ACTION}22`,
              borderRadius: 10,
              color: ACTION,
              display: "inline-flex",
              fontSize: 13,
              fontWeight: 800,
              height: 40,
              justifyContent: "center",
              minWidth: 40,
            }}
          >
            BMO
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: BRAND,
                fontSize: 17,
                fontWeight: 800,
                lineHeight: 1.2,
              }}
            >
              BMO ISO 19650
            </div>
            <div
              style={{
                color: "#5f7289",
                fontSize: 12,
                lineHeight: 1.3,
                marginTop: 2,
              }}
            >
              Compliance SaaS
            </div>
          </div>
        </Link>

        {user ? (
          <nav
            aria-label="Navegacion principal"
            style={{
              alignItems: "center",
              display: "flex",
              gap: 8,
              justifyContent: "center",
              minWidth: 0,
            }}
          >
            {visibleNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                style={{
                  background: item.active ? ACTION : "transparent",
                  border: `1px solid ${item.active ? ACTION : "transparent"}`,
                  borderRadius: 8,
                  color: item.active ? "white" : BRAND,
                  fontSize: 14,
                  fontWeight: 700,
                  padding: "10px 14px",
                  textDecoration: "none",
                  transition:
                    "background-color 160ms ease, color 160ms ease, border-color 160ms ease",
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : (
          <div />
        )}

        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            minWidth: 0,
          }}
        >
          {!user && !isAuthPage && !loadingUser && (
            <>
              <Link href="/login" style={ghostLinkStyle}>
                Login
              </Link>
              <Link href="/register" style={primaryLinkStyle}>
                Registro
              </Link>
            </>
          )}

          {user && (
            <>
              <div
                style={{
                  alignItems: "center",
                  background: SURFACE,
                  border: "1px solid #dbe3f1",
                  borderRadius: 10,
                  color: BRAND,
                  display: "inline-flex",
                  fontSize: 13,
                  fontWeight: 700,
                  maxWidth: 220,
                  minHeight: 40,
                  padding: "0 12px",
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user.name || user.email}
                </span>
              </div>

              <button onClick={logout} style={ghostButtonStyle}>
                Logout
              </button>

              <Link href="/account/security" style={ghostLinkStyle}>
                Seguridad
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function isRouteActive(pathname: string, href: string) {
  if (href === "/matrix") {
    return pathname === "/matrix" || pathname.endsWith("/matrix");
  }

  if (href === "/admin") {
    return pathname === "/admin" || pathname.startsWith("/admin/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

const ghostLinkStyle: React.CSSProperties = {
  border: "1px solid #dbe3f1",
  borderRadius: 8,
  color: BRAND,
  fontSize: 14,
  fontWeight: 700,
  minHeight: 40,
  padding: "10px 14px",
  textDecoration: "none",
};

const primaryLinkStyle: React.CSSProperties = {
  background: ACTION,
  border: `1px solid ${ACTION}`,
  borderRadius: 8,
  color: "white",
  fontSize: 14,
  fontWeight: 700,
  minHeight: 40,
  padding: "10px 14px",
  textDecoration: "none",
};

const ghostButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #dbe3f1",
  borderRadius: 8,
  color: BRAND,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 700,
  minHeight: 40,
  padding: "10px 14px",
  transition: "background-color 160ms ease, border-color 160ms ease",
};
