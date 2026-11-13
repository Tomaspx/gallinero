import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { codigoJaula, hace, NOMBRE_EVENTO } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { cambiarEstadoJaula, crearJaulas } from "@/app/actions/admin";

export const metadata = { title: "Jaulas · Gallinero" };

export default async function Jaulas() {
  await requireAdmin("/admin/jaulas");
  const jaulas = await db()`
    select s.*, us.nombre as ultimo_nombre,
      (select codigo from etiquetas e where e.jaula_id = s.id and e.estado = 'activa' limit 1) as etiqueta
    from jaulas_estado s left join usuarios us on us.id = s.ultimo_usuario_id
    order by s.galpon, s.fila, s.numero`;

  const grupos = new Map<string, typeof jaulas>();
  for (const j of jaulas) {
    const k = `Galpón ${j.galpon} · Fila ${j.fila}`;
    if (!grupos.has(k)) grupos.set(k, [] as unknown as typeof jaulas);
    grupos.get(k)!.push(j);
  }
  const conEtiqueta = jaulas.filter((j) => j.etiqueta && j.activa).length;

  return (
    <>
      <h1>Jaulas muestra</h1>
      <p className="suave">
        {jaulas.length} jaulas cargadas, {conEtiqueta} activas con etiqueta. Conviene repartir la muestra en todas las
        filas y galpones.
      </p>

      <div className="tarjeta">
        <h2 style={{ marginTop: 0 }}>Cargar jaulas</h2>
        <ActionForm action={crearJaulas} boton="Crear jaulas">
          <div className="fila-campos">
            <div className="campo">
              <label htmlFor="galpon">Galpón</label>
              <input id="galpon" name="galpon" inputMode="numeric" required />
            </div>
            <div className="campo">
              <label htmlFor="fila">Fila</label>
              <input id="fila" name="fila" inputMode="numeric" required />
            </div>
            <div className="campo">
              <label htmlFor="desde">Jaula desde</label>
              <input id="desde" name="desde" inputMode="numeric" required />
            </div>
            <div className="campo">
              <label htmlFor="hasta">Jaula hasta</label>
              <input id="hasta" name="hasta" inputMode="numeric" required />
            </div>
            <div className="campo">
              <label htmlFor="aves">Aves por jaula</label>
              <input id="aves" name="aves" inputMode="numeric" defaultValue={4} required />
            </div>
          </div>
          <p className="suave">
            <small>Para una sola jaula, poné el mismo número en “desde” y “hasta”.</small>
          </p>
        </ActionForm>
      </div>

      {[...grupos.entries()].map(([titulo, lista]) => (
        <div className="tarjeta" key={titulo}>
          <h2 style={{ marginTop: 0 }}>{titulo}</h2>
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Jaula</th>
                  <th className="num">Aves</th>
                  <th>Último registro</th>
                  <th>Etiqueta</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lista.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <Link href={`/admin/jaulas/${j.id}`}>{codigoJaula(j.galpon, j.fila, j.numero)}</Link>
                      {!j.activa && (
                        <>
                          {" "}
                          <span className="chip rojo">desactivada</span>
                        </>
                      )}
                    </td>
                    <td className="num">{j.aves ?? "?"}</td>
                    <td>
                      {j.ultimo_registro ? (
                        <>
                          {hace(j.ultimo_registro)} · {NOMBRE_EVENTO[j.ultimo_tipo]}
                          <br />
                          <small className="suave">{j.ultimo_nombre}</small>
                        </>
                      ) : (
                        <span className="suave">sin registros</span>
                      )}
                    </td>
                    <td>{j.etiqueta ? <span className="chip verde">{j.etiqueta}</span> : <span className="chip">sin etiqueta</span>}</td>
                    <td>
                      <form action={cambiarEstadoJaula}>
                        <input type="hidden" name="id" value={j.id} />
                        <button className="btn chico" type="submit">
                          {j.activa ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}
