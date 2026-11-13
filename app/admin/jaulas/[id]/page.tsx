import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { codigoJaula, detalleEvento, fechaHora, NOMBRE_EVENTO } from "@/lib/format";
import { BotonAnular } from "@/components/BotonAnular";
import { anularEvento } from "@/app/actions/admin";
import { JaulaPantalla } from "@/app/t/[codigo]/JaulaPantalla";

export const metadata = { title: "Historial de jaula · Gallinero" };

export default async function HistorialJaula({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  await requireAdmin(`/admin/jaulas/${id}`);
  const sql = db();
  const [j] = await sql`select * from jaulas_estado where id = ${id}`;
  if (!j) notFound();
  const etiquetas = await sql`select codigo, estado, asignada from etiquetas where jaula_id = ${id} order by asignada desc`;
  const eventos = await sql`
    select e.id, e.tipo, e.datos, e.creado, u.nombre,
      exists (select 1 from eventos a where a.anula_id = e.id) as anulado
    from eventos e join usuarios u on u.id = e.usuario_id
    where e.jaula_id = ${id} order by e.creado desc, e.id desc limit 300`;
  const cod = codigoJaula(j.galpon, j.fila, j.numero);

  return (
    <>
      <p>
        <Link href="/admin/jaulas">← Jaulas</Link>
      </p>
      <h1>
        {cod} {!j.activa && <span className="chip rojo">desactivada</span>}
      </h1>
      <p className="suave">
        {j.aves ?? "?"} aves ·{" "}
        {etiquetas.find((e) => e.estado === "activa")
          ? `etiqueta ${etiquetas.find((e) => e.estado === "activa")!.codigo}`
          : "sin etiqueta activa"}
      </p>

      <details className="tarjeta">
        <summary>Cargar un registro o ajustar aves desde acá</summary>
        <div style={{ marginTop: "0.75rem" }}>
          <JaulaPantalla jaulaId={j.id} codigo={cod} aves={j.aves} esAdmin />
        </div>
      </details>

      <div className="tarjeta">
        <h2 style={{ marginTop: 0 }}>Historial</h2>
        <p className="suave">
          <small>Los registros no se borran. Si uno está mal, se anula y queda tachado.</small>
        </p>
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Registro</th>
                <th>Detalle</th>
                <th>Usuario</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => (
                <tr key={e.id} className={e.anulado ? "anulado" : undefined}>
                  <td>{fechaHora(e.creado)}</td>
                  <td>{NOMBRE_EVENTO[e.tipo]}</td>
                  <td>
                    {detalleEvento(e.tipo, e.datos)} <small className="suave">#{e.id}</small>
                  </td>
                  <td>{e.nombre}</td>
                  <td>{e.tipo !== "anulacion" && !e.anulado && <BotonAnular id={e.id} action={anularEvento} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
