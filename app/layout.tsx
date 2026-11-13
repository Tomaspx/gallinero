import type { Metadata, Viewport } from "next";
import { dbUrl } from "@/lib/db";
import "./globals.css";

// Todo depende de la base y de la sesión: nada se genera estático en el build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gallinero",
  description: "Gestión del gallinero: stock de huevos y reporte de jaulas",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f3ec",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {dbUrl ? (
          children
        ) : (
          <main className="contenedor angosto">
            <h1>Falta conectar la base de datos</h1>
            <p>
              La app está publicada pero todavía no tiene base de datos. En Vercel, abrí el proyecto, andá a{" "}
              <strong>Storage</strong>, creá una base de Supabase y conectala a este proyecto. Después volvé a
              publicar (Deployments → Redeploy).
            </p>
          </main>
        )}
      </body>
    </html>
  );
}
