"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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
        <SidebarLink href="/">Inicio</SidebarLink>
        <SidebarLink href="/projects">Proyectos</SidebarLink>
        <SidebarLink href="/dashboard">Dashboard</SidebarLink>
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
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 8,
        color: "white",
        background: active ? "#0025df" : hovered ? "rgba(255, 255, 255, 0.08)" : "transparent",
        boxShadow:
          hovered && !active ? "0 8px 18px rgba(0, 0, 0, 0.18)" : "none",
        padding: "10px 12px",
        textDecoration: "none",
        transform: hovered && !active ? "translateX(3px)" : "translateX(0)",
        transition:
          "background-color 160ms ease, transform 160ms ease, box-shadow 160ms ease",
      }}
    >
      {children}
    </Link>
  );
}
