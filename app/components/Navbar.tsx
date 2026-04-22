"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
};

const links = [
  { href: "/", label: "Inicio" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Proyectos" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);

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
      });
  }, [pathname]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
    router.refresh();
  };

  const isAuthPage = pathname === "/login" || pathname === "/register";

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 20,
        padding: "14px 40px",
        borderBottom: "1px solid #e5e7eb",
        background: "white",
      }}
    >
      <Link href={user ? "/dashboard" : "/login"} style={{ fontWeight: 700, textDecoration: "none", color: "#111" }}>
        BMO ISO 19650
      </Link>

      <nav style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {user &&
          links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: active ? "#111" : "#555",
                  background: active ? "#eef2ff" : "transparent",
                }}
              >
                {link.label}
              </Link>
            );
          })}

        {!user && !isAuthPage && (
          <>
            <Link href="/login" style={navLinkStyle}>
              Login
            </Link>
            <Link href="/register" style={navLinkStyle}>
              Registro
            </Link>
          </>
        )}

        {user && (
          <>
            <span style={{ color: "#6b7280", fontSize: 13 }}>
              {user.name || user.email}
            </span>
            <button
              onClick={logout}
              style={{
                background: "white",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                color: "#111",
                cursor: "pointer",
                padding: "8px 12px",
              }}
            >
              Logout
            </button>
          </>
        )}
      </nav>
    </header>
  );
}

const navLinkStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  textDecoration: "none",
  color: "#555",
};
