"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getUserRoleBadgeStyle,
  getUserStatusBadgeStyle,
} from "@/components/uiStyles";

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
const BORDER = "#dbe3f1";
const MUTED = "#5f7289";
const SIDEBAR_WIDTH = 224;

const navigationGroups = [
  {
    label: "Principal",
    items: [
      { href: "/", label: "Inicio" },
      { href: "/projects", label: "Proyectos" },
      { href: "/dashboard", label: "Dashboard" },
      { href: "/matrix", label: "Matriz" },
    ],
  },
  {
    label: "Cuenta",
    items: [{ href: "/profile", label: "Perfil" }],
  },
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

  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password";
  const authenticatedUser = isAuthPage ? null : user;

  useEffect(() => {
    document.body.classList.toggle("bmo-authenticated-shell", Boolean(authenticatedUser));

    return () => {
      document.body.classList.remove("bmo-authenticated-shell");
    };
  }, [authenticatedUser]);

  const visibleNavigation = useMemo(() => {
    if (!authenticatedUser) return [];

    const groups = navigationGroups.map((group) => ({
      ...group,
      items: [...group.items],
    }));

    if (authenticatedUser.role === "admin") {
      groups[1].items.push({ href: "/admin", label: "Admin" });
    }

    return groups.map((group) => ({
      ...group,
      items: group.items.map((item) => ({
        ...item,
        active: isRouteActive(pathname, item.href),
      })),
    }));
  }, [authenticatedUser, pathname]);

  const currentPageLabel =
    visibleNavigation
      .flatMap((group) => group.items)
      .find((item) => item.active)?.label || "BMO ISO 19650";

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    document.body.classList.remove("bmo-authenticated-shell");
    router.push("/login");
    router.refresh();
  };

  if (!authenticatedUser) {
    return (
      <header style={authHeaderStyle}>
        <div style={authHeaderInnerStyle}>
          <BrandMark href="/login" />

          <div style={authActionsStyle}>
            {!isAuthPage && !loadingUser && (
              <>
                <Link href="/login" style={ghostLinkStyle}>
                  Login
                </Link>
                <Link href="/register" style={primaryLinkStyle}>
                  Registro
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
    );
  }

  return (
    <>
      <aside style={sidebarStyle} aria-label="Navegacion principal">
        <div style={sidebarBrandStyle}>
          <BrandMark href="/dashboard" compact />
        </div>

        <nav style={navStyle}>
          {visibleNavigation.map((group) => (
            <div key={group.label} style={navGroupStyle}>
              <div style={navLabelStyle}>{group.label}</div>
              <div style={navItemsStyle}>
                {group.items.map((item) => (
                  <SideNavLink
                    key={item.href}
                    href={item.href}
                    active={item.active}
                  >
                    {item.label}
                  </SideNavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div style={sidebarFooterStyle}>
          <Link href="/profile" style={userCardStyle}>
            <span style={userInfoStyle}>
              <span style={userNameStyle}>
                {authenticatedUser.name || authenticatedUser.email}
              </span>
              <span style={userMetaStyle}>{authenticatedUser.email}</span>
            </span>
          </Link>

          <div style={footerBadgesStyle}>
            <span style={navbarBadgeStyle(getUserRoleBadgeStyle(authenticatedUser.role))}>
              {authenticatedUser.role === "admin" ? "ADMIN" : "USER"}
            </span>
            {authenticatedUser.status !== "active" && (
              <span style={navbarBadgeStyle(getUserStatusBadgeStyle(authenticatedUser.status))}>
                {authenticatedUser.status === "blocked" ? "BLOCKED" : "SUSPENDED"}
              </span>
            )}
          </div>

          <button onClick={logout} style={logoutButtonStyle}>
            Logout
          </button>
        </div>
      </aside>

      <header style={topbarStyle}>
        <div style={topbarTitleStyle}>
          <span style={topbarEyebrowStyle}>BMO ISO 19650</span>
          <span style={topbarPageStyle}>{currentPageLabel}</span>
        </div>
        <div style={topbarActionsStyle}>
          <span style={compactUserStyle}>
            {authenticatedUser.name || authenticatedUser.email}
          </span>
          <button onClick={logout} style={compactLogoutStyle}>
            Logout
          </button>
        </div>
      </header>
    </>
  );
}

function BrandMark({
  href,
  compact = false,
}: {
  href: string;
  compact?: boolean;
}) {
  return (
    <Link href={href} style={brandLinkStyle}>
      <span aria-hidden="true" style={brandIconStyle}>
        BMO
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ ...brandNameStyle, fontSize: compact ? 17 : 18 }}>
          BMO ISO 19650
        </span>
        <span style={brandTagStyle}>Compliance SaaS</span>
      </span>
    </Link>
  );
}

function SideNavLink({
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
        ...navItemStyle,
        background: active ? "#eef4ff" : hovered ? SURFACE : "transparent",
        borderColor: active ? "#bfdbfe" : hovered ? BORDER : "transparent",
        boxShadow: active ? `inset 3px 0 0 ${ACTION}` : "none",
        color: BRAND,
      }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{children}</span>
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

  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function navbarBadgeStyle(style: React.CSSProperties): React.CSSProperties {
  return {
    ...style,
    alignItems: "center",
    fontSize: 11,
    letterSpacing: 0,
    minHeight: 28,
    padding: "6px 9px",
  };
}

const authHeaderStyle: React.CSSProperties = {
  background: "#ffffff",
  borderBottom: `1px solid ${BORDER}`,
  minHeight: 70,
  position: "sticky",
  top: 0,
  zIndex: 40,
};

const authHeaderInnerStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 16,
  justifyContent: "space-between",
  margin: "0 auto",
  maxWidth: 1440,
  minHeight: 70,
  padding: "0 28px",
};

const authActionsStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 10,
};

const sidebarStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRight: `1px solid ${BORDER}`,
  bottom: 0,
  display: "flex",
  flexDirection: "column",
  left: 0,
  position: "fixed",
  top: 0,
  width: SIDEBAR_WIDTH,
  zIndex: 50,
};

const sidebarBrandStyle: React.CSSProperties = {
  borderBottom: `1px solid ${BORDER}`,
  padding: 18,
};

const brandLinkStyle: React.CSSProperties = {
  alignItems: "center",
  color: BRAND,
  display: "inline-flex",
  gap: 12,
  minWidth: 0,
  textDecoration: "none",
};

const brandIconStyle: React.CSSProperties = {
  alignItems: "center",
  background: SURFACE,
  border: `1px solid ${ACTION}22`,
  borderRadius: 10,
  color: ACTION,
  display: "inline-flex",
  flexShrink: 0,
  fontSize: 12,
  fontWeight: 700,
  height: 36,
  justifyContent: "center",
  width: 36,
};

const brandNameStyle: React.CSSProperties = {
  color: BRAND,
  display: "block",
  fontWeight: 650,
  lineHeight: 1.1,
  whiteSpace: "nowrap",
};

const brandTagStyle: React.CSSProperties = {
  color: MUTED,
  display: "block",
  fontSize: 12,
  lineHeight: 1.3,
  marginTop: 2,
  whiteSpace: "nowrap",
};

const navStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
  overflowY: "auto",
  padding: "16px 12px",
};

const navGroupStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const navLabelStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: `1px solid ${BORDER}`,
  borderLeft: `3px solid ${ACTION}`,
  borderRadius: 8,
  color: BRAND,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 0,
  lineHeight: 1,
  padding: "8px 10px",
  textTransform: "uppercase",
};

const navItemsStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  paddingLeft: 6,
};

const navItemStyle: React.CSSProperties = {
  alignItems: "center",
  border: "1px solid transparent",
  borderRadius: 8,
  display: "flex",
  gap: 10,
  fontSize: 13,
  fontWeight: 500,
  minHeight: 38,
  overflow: "hidden",
  padding: "7px 12px",
  textDecoration: "none",
  transition: "background-color 160ms ease, border-color 160ms ease, color 160ms ease",
  whiteSpace: "nowrap",
};

const sidebarFooterStyle: React.CSSProperties = {
  borderTop: `1px solid ${BORDER}`,
  display: "grid",
  gap: 10,
  marginTop: "auto",
  padding: 10,
};

const userCardStyle: React.CSSProperties = {
  alignItems: "center",
  borderRadius: 8,
  color: BRAND,
  display: "flex",
  minWidth: 0,
  padding: "8px 10px",
  textDecoration: "none",
};

const userInfoStyle: React.CSSProperties = {
  display: "grid",
  minWidth: 0,
};

const userNameStyle: React.CSSProperties = {
  color: BRAND,
  fontSize: 13,
  fontWeight: 600,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const userMetaStyle: React.CSSProperties = {
  color: MUTED,
  fontSize: 11,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const footerBadgesStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  padding: "0 8px",
};

const logoutButtonStyle: React.CSSProperties = {
  background: "#ffffff",
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  color: BRAND,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  minHeight: 38,
  padding: "8px 12px",
  textAlign: "left",
};

const topbarStyle: React.CSSProperties = {
  alignItems: "center",
  background: "rgba(255,255,255,0.94)",
  borderBottom: `1px solid ${BORDER}`,
  display: "flex",
  gap: 16,
  height: 56,
  justifyContent: "space-between",
  left: SIDEBAR_WIDTH,
  padding: "0 clamp(18px, 2.6vw, 34px)",
  position: "fixed",
  right: 0,
  top: 0,
  zIndex: 45,
};

const topbarTitleStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
  minWidth: 0,
};

const topbarEyebrowStyle: React.CSSProperties = {
  color: MUTED,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const topbarPageStyle: React.CSSProperties = {
  color: BRAND,
  fontSize: 16,
  fontWeight: 600,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const topbarActionsStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 10,
  minWidth: 0,
};

const compactUserStyle: React.CSSProperties = {
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  color: BRAND,
  fontSize: 13,
  fontWeight: 600,
  maxWidth: 180,
  overflow: "hidden",
  padding: "7px 10px",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const compactLogoutStyle: React.CSSProperties = {
  ...logoutButtonStyle,
  minHeight: 34,
  padding: "6px 10px",
};

const ghostLinkStyle: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  color: BRAND,
  fontSize: 14,
  fontWeight: 600,
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
  fontWeight: 600,
  minHeight: 40,
  padding: "10px 14px",
  textDecoration: "none",
};
