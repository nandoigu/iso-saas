export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main
      style={{
        background: "#f4f6fc",
        minHeight: "calc(100vh - 70px)",
        padding: "28px clamp(20px, 3vw, 36px) 40px",
      }}
    >
      <div
        style={{
          margin: "0 auto",
          maxWidth: 1440,
        }}
      >
        {children}
      </div>
    </main>
  );
}
