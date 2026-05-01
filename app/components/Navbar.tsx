"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
};

const BRAND = "#002a4e";
const ACTION = "#0025df";
const SURFACE = "#f4f6fc";

const navigationItems = [
  { href: "/", label: "Inicio" },
  { href: "/projects", label: "Proyectos" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profile", label: "Perfil" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    const loadUser = () => {
      setLoadingUser(true);

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
    };

    const handleUserUpdated = () => {
      loadUser();
    };

    loadUser();
    window.addEventListener("bmo:user-updated", handleUserUpdated);

    return () => {
      window.removeEventListener("bmo:user-updated", handleUserUpdated);
    };
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
              <TopNavLink
                key={item.href}
                href={item.href}
                active={item.active}
              >
                {item.label}
              </TopNavLink>
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
              <div style={userPillStyle}>
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

              <span style={getRoleBadgeStyle(user.role)}>{user.role === "admin" ? "ADMIN" : "USER"}</span>

              {user.status !== "active" && (
                <span style={getStatusBadgeStyle(user.status)}>
                  {user.status === "blocked" ? "BLOCKED" : "SUSPENDED"}
                </span>
              )}

              <button onClick={logout} style={ghostButtonStyle}>
                Logout
              </button>

            </>
          )}
        </div>
      </div>
    </header>
  );
}

function TopNavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: active ? ACTION : hovered ? `${ACTION}14` : "transparent",
        border: `1px solid ${active ? ACTION : hovered ? `${ACTION}26` : "transparent"}`,
        borderRadius: 8,
        color: active ? "white" : BRAND,
        fontSize: 14,
        fontWeight: 700,
        padding: "10px 14px",
        textDecoration: "none",
        transform: hovered && !active ? "translateY(-1px)" : "translateY(0)",
        transition:
          "background-color 160ms ease, color 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease",
        boxShadow:
          hovered && !active ? "0 6px 18px rgba(0, 37, 223, 0.10)" : "none",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </Link>
  );
}

function isRouteActive(pathname: string, href: string) {
  if (href === "/matrix") {
    return pathname === "/matrix" || pathname.endsWith("/matrix");
  }

  if (href === "/admin") {
    return pathname === "/admin" || pathname.startsWith("/admin/");
  }

  if (href === "/profile") {
    return pathname === "/profile" || pathname.startsWith("/profile/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getRoleBadgeStyle(role: string): React.CSSProperties {
  return {
    background: role === "admin" ? "#dbeafe" : "#eef2ff",
    border: `1px solid ${role === "admin" ? "#93c5fd" : "#c7d2fe"}`,
    borderRadius: 999,
    color: role === "admin" ? "#1d4ed8" : "#4338ca",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.04em",
    minHeight: 40,
    padding: "10px 12px",
    whiteSpace: "nowrap",
  };
}

function getStatusBadgeStyle(status: string): React.CSSProperties {
  const map = {
    suspended: { background: "#fff7ed", border: "#fdba74", color: "#c2410c" },
    blocked: { background: "#fef2f2", border: "#fecaca", color: "#b91c1c" },
  } as const;

  const current = map[status as keyof typeof map] || map.suspended;

  return {
    background: current.background,
    border: `1px solid ${current.border}`,
    borderRadius: 999,
    color: current.color,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.04em",
    minHeight: 40,
    padding: "10px 12px",
    whiteSpace: "nowrap",
  };
}

const userPillStyle: React.CSSProperties = {
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
};

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
