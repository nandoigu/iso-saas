import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 61px)" }}>
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          background: "#111827",
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
          background: "#f7f9fc",
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
  return (
    <Link
      href={href}
      style={{
        borderRadius: 8,
        color: "white",
        padding: "10px 12px",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}
