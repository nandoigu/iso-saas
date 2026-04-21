import "./globals.css";

export const metadata = {
  title: "BMO ISO 19650",
  description: "Plataforma de gestión de cumplimiento ISO 19650",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          fontFamily: "Arial, sans-serif",
          background: "#f7f9fc",
        }}
      >
        <main
          style={{
            padding: 40,
            maxWidth: 1200,
            margin: "0 auto",
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}