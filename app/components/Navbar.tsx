import Link from "next/link";

export default function Navbar() {
  return (
    <div style={{ padding: 20 }}>
      <Link href="/">Inicio</Link>
      <br />
      <Link href="/dashboard">Dashboard</Link>
    </div>
  );
}