"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Stock" },
  { href: "/admin/reportes", label: "Reportes" },
  { href: "/admin/jaulas", label: "Jaulas" },
  { href: "/admin/operarios", label: "Usuarios" },
  { href: "/admin/etiquetas", label: "Etiquetas" },
];

export function NavAdmin() {
  const ruta = usePathname();
  return (
    <nav className="nav">
      {LINKS.map((l) => {
        const activo = l.href === "/admin" ? ruta === "/admin" : ruta.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={activo ? "activo" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
