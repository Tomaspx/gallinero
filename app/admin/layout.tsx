import { requireAdmin } from "@/lib/auth";
import { Barra } from "@/components/Barra";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const u = await requireAdmin();
  return (
    <>
      <Barra u={u} />
      <main className="contenedor">{children}</main>
    </>
  );
}
