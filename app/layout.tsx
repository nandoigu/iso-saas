import "./globals.css";
import Navbar from "./components/Navbar";

export const metadata = {
  title: "BMO ISO 19650",
  description:
    "Plataforma para controlar requisitos, evidencias y cumplimiento ISO 19650 en proyectos BIM.",
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
        <div className="bmo-app-content">{children}</div>
      </body>
    </html>
  );
}
