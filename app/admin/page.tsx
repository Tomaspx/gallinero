import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { stockActual } from "@/lib/consultas";
import { diaCorto, fechaHora, HUEVOS_POR_MAPLE, TZ } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { BotonAnular } from "@/components/BotonAnular";
import { anularMovimiento, registrarRecuento, registrarSalida } from "@/app/actions/admin";
import { registrarJuntada } from "@/app/actions/registro";

export const metadata = { title: "Stock · Gallinero" };

const TIPO: Record<string, string> = { juntada: "Juntada", salida: "Salida", recuento: "Recuento", anulacion: "Anulación" };

export default async function Stock() {
  await requireAdmin();
  const sql = db();
  const { stock, ultimoRecuento } = await stockActual(sql);

  const dias = await sql`
    with d as (
      select generate_series((now() at time zone ${TZ})::date - 13, (now() at time zone ${TZ})::date, '1 day')::date as dia
    )
    select to_char(d.dia, 'YYYY-MM-DD') as dia,
      coalesce(sum(m.maples) filter (where m.tipo = 'juntada'), 0)::int as juntados,
      coalesce(sum(m.maples) filter (where m.tipo = 'salida'), 0)::int as entregados
    from d left join movimientos_vigentes m on (m.creado at time zone ${TZ})::date = d.dia
    group by d.dia order by d.dia desc`;
  const hoy = dias[0];
  const maxDia = Math.max(1, ...dias.map((d) => Math.max(d.juntados, d.entregados)));

  const destinos = await sql`
    select destino, sum(maples)::int as maples, count(*)::int as salidas, max(creado) as ultima
    from movimientos_vigentes
    where tipo = 'salida' and creado > now() - interval '30 days'
    group by destino order by maples desc`;

  const movimientos = await sql`
    select m.id, m.tipo, m.maples, m.destino, m.nota, m.creado, m.anula_id, u.nombre,
      exists (select 1 from movimientos_stock a where a.anula_id = m.id) as anulado
    from movimientos_stock m join usuarios u on u.id = m.usuario_id
    order by m.creado desc, m.id desc limit 60`;

  return (
    <>
      <h1>Stock de huevos</h1>
      <div className="grilla">
        <div className="tarjeta">
          <small>Stock actual</small>
          <div className="cifra">
            {stock} <small>maples</small>
          </div>
          <small>
            ≈ {(stock * HUEVOS_POR_MAPLE).toLocaleString("es-AR")} huevos
            {ultimoRecuento ? ` · último recuento ${fechaHora(ultimoRecuento)}` : ""}
          </small>
        </div>
        <div className="tarjeta">
          <small>Hoy</small>
          <div className="cifra">
            +{hoy.juntados} <small>juntados</small>
          </div>
          <small>−{hoy.entregados} maples entregados</small>
        </div>
      </div>

      <div className="grilla">
        <div className="tarjeta">
          <h2 style={{ marginTop: 0 }}>Registrar salida</h2>
          <ActionForm action={registrarSalida} boton="Descontar del stock" limpiarAlGuardar>
            <div className="fila-campos">
              <div className="campo">
                <label htmlFor="s-maples">Maples</label>
                <input id="s-maples" name="maples" inputMode="numeric" required />
              </div>
              <div className="campo">
                <label htmlFor="s-destino">Destino</label>
                <input id="s-destino" name="destino" placeholder="Cliente o motivo" list="destinos" required />
                <datalist id="destinos">
                  {destinos.map((d) => (
                    <option key={d.destino} value={d.destino} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="campo">
              <label htmlFor="s-nota">Nota (opcional)</label>
              <input id="s-nota" name="nota" />
            </div>
          </ActionForm>
        </div>

        <div className="tarjeta">
          <h2 style={{ marginTop: 0 }}>Recuento físico</h2>
          <p className="suave">
            <small>Cuando cuentes los maples a mano, cargalos acá: el stock pasa a ser ese número.</small>
          </p>
          <ActionForm action={registrarRecuento} boton="Fijar stock" limpiarAlGuardar>
            <div className="fila-campos">
              <div className="campo">
                <label htmlFor="r-maples">Maples contados</label>
                <input id="r-maples" name="maples" inputMode="numeric" required />
              </div>
              <div className="campo">
                <label htmlFor="r-nota">Motivo (opcional)</label>
                <input id="r-nota" name="nota" />
              </div>
            </div>
          </ActionForm>
          <details style={{ marginTop: "1rem" }}>
            <summary>Cargar una juntada sin el parche general</summary>
            <ActionForm action={registrarJuntada} boton="Sumar juntada" limpiarAlGuardar>
              <div className="campo">
                <label htmlFor="j-maples">Maples juntados</label>
                <input id="j-maples" name="maples" inputMode="numeric" required />
              </div>
            </ActionForm>
          </details>
        </div>
      </div>

      <div className="grilla">
        <div className="tarjeta">
          <h2 style={{ marginTop: 0 }}>Últimos 14 días</h2>
          <p className="suave">
            <small>
              <span className="chip verde">juntados</span> <span className="chip yema">entregados</span> en maples
            </small>
          </p>
          <div className="barras">
            {dias.map((d) => (
              <div key={d.dia}>
                <div className="barra-fila">
                  <span>{diaCorto(d.dia)}</span>
                  <div className="barra-pista">
                    <div className="barra-valor" style={{ width: `${(d.juntados / maxDia) * 100}%` }} />
                  </div>
                  <span className="num">{d.juntados}</span>
                </div>
                <div className="barra-fila">
                  <span />
                  <div className="barra-pista">
                    <div className="barra-valor salida" style={{ width: `${(d.entregados / maxDia) * 100}%` }} />
                  </div>
                  <span className="num">{d.entregados}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="tarjeta">
          <h2 style={{ marginTop: 0 }}>Salidas por destino</h2>
          <p className="suave">
            <small>Últimos 30 días</small>
          </p>
          {destinos.length === 0 ? (
            <p className="suave">Todavía no hay salidas.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Destino</th>
                  <th className="num">Maples</th>
                  <th className="num">Salidas</th>
                </tr>
              </thead>
              <tbody>
                {destinos.map((d) => (
                  <tr key={d.destino}>
                    <td>{d.destino}</td>
                    <td className="num">{d.maples}</td>
                    <td className="num">{d.salidas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="tarjeta">
        <h2 style={{ marginTop: 0 }}>Movimientos</h2>
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th className="num">Maples</th>
                <th>Detalle</th>
                <th>Usuario</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.id} className={m.anulado ? "anulado" : undefined}>
                  <td>{fechaHora(m.creado)}</td>
                  <td>{TIPO[m.tipo]}</td>
                  <td className="num">
                    {m.tipo === "anulacion" ? "" : m.tipo === "salida" ? `−${m.maples}` : m.tipo === "juntada" ? `+${m.maples}` : `=${m.maples}`}
                  </td>
                  <td>
                    {m.tipo === "anulacion" ? `Anula el movimiento #${m.anula_id}` : [m.destino, m.nota].filter(Boolean).join(" · ")}
                    <small className="suave"> #{m.id}</small>
                  </td>
                  <td>{m.nombre}</td>
                  <td>{m.tipo !== "anulacion" && !m.anulado && <BotonAnular id={m.id} action={anularMovimiento} />}</td>
                </tr>
              ))}
              {movimientos.length === 0 && (
                <tr>
                  <td colSpan={6} className="suave">
                    Todavía no hay movimientos. Las juntadas se cargan desde el parche general.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
