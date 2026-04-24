"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 70px)" }}>
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          background: "#002a4e",
          color: "white",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <h2 style={{ margin: "0 0 20px" }}>BMO</h2>
        <SidebarLink href="/dashboard">Dashboard</SidebarLink>
        <SidebarLink href="/">Inicio</SidebarLink>
        <SidebarLink href="/projects">Proyectos</SidebarLink>
      </aside>

      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding: 40,
          background: "#f4f6fc",
        }}
      >
        {children}
      </main>
    </div>
  );
}

function SidebarLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      style={{
        borderRadius: 8,
        color: "white",
        background: active ? "#0025df" : "transparent",
        padding: "10px 12px",
        textDecoration: "none",
        transition: "background-color 160ms ease",
      }}
    >
      {children}
    </Link>
  );
}
