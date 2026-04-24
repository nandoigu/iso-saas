import "./globals.css";
import Navbar from "./components/Navbar";

export const metadata = {
  title: "BMO ISO 19650",
  description: "Plataforma de gestion de cumplimiento ISO 19650",
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
          background: "#f4f6fc",
          color: "#002a4e",
        }}
      >
        <Navbar />
        <div style={{ minHeight: "calc(100vh - 70px)" }}>{children}</div>
      </body>
    </html>
  );
}
