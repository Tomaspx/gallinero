import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { codigoJaula, detalleEvento, diaCorto, fechaHora, hoyISO, NOMBRE_EVENTO, TZ } from "@/lib/format";

export const metadata = { title: "Reportes · Gallinero" };

const esFecha = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const pct = (v: number | null) => (v === null || v === undefined ? "—" : `${(Number(v) * 100).toFixed(1)}%`);
const dec = (v: number | null, d = 2) => (v === null || v === undefined ? "—" : Number(v).toFixed(d).replace(".", ","));

export default async function Reportes({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; galpon?: string; tipo?: string }>;
}) {
  await requireAdmin("/admin/reportes");
  const sp = await searchParams;
  const desde = esFecha(sp.desde) ? sp.desde! : hoyISO(-6);
  const hasta = esFecha(sp.hasta) ? sp.hasta! : hoyISO();
  const galpon = sp.galpon && /^\d+$/.test(sp.galpon) ? Number(sp.galpon) : null;
  const tipoNov = sp.tipo === "problema" || sp.tipo === "sanidad" ? sp.tipo : null;
  const sql = db();

  const galpones = await sql`select numero from galpones order by numero`;

  const resumen = await sql`
    with s as (
      select * from jaulas_estado where activa and (${galpon}::int is null or galpon = ${galpon}::int)
    ),
    ev as (
      select e.*, (e.creado at time zone ${TZ})::date as dia
      from eventos_vigentes e join s on s.id = e.jaula_id
      where (e.creado at time zone ${TZ})::date between ${desde}::date and ${hasta}::date
    ),
    hd as (
      select jaula_id, dia,
        sum((datos->>'buenos')::int + (datos->>'rotos')::int + (datos->>'sucios')::int) as total,
        sum((datos->>'rotos')::int) as rotos, sum((datos->>'sucios')::int) as sucios
      from ev where tipo = 'huevos' group by jaula_id, dia
    ),
    pj as (
      select s.id, s.galpon, s.fila, coalesce(s.aves, 0) as aves,
        (select count(*) from hd where hd.jaula_id = s.id) as dias_huevos,
        (select coalesce(sum(total), 0) from hd where hd.jaula_id = s.id) as huevos,
        (select coalesce(sum(rotos), 0) from hd where hd.jaula_id = s.id) as rotos,
        (select coalesce(sum(sucios), 0) from hd where hd.jaula_id = s.id) as sucios,
        (select coalesce(sum((datos->>'cantidad')::int), 0) from ev where ev.jaula_id = s.id and tipo = 'mortandad') as muertas,
        (select count(*) from ev where ev.jaula_id = s.id and tipo not in ('ajuste_aves')) as registros
      from s
    )
    select galpon, fila, (grouping(fila) = 1) as es_total,
      count(*)::int as jaulas, sum(aves)::int as aves,
      sum(huevos)::int as huevos,
      (sum(huevos)::numeric / nullif(sum(aves * dias_huevos), 0))::float as postura,
      (sum(rotos)::numeric / nullif(sum(huevos), 0))::float as p_rotos,
      (sum(sucios)::numeric / nullif(sum(huevos), 0))::float as p_sucios,
      sum(muertas)::int as muertas,
      (sum(muertas)::numeric / nullif(sum(aves) + sum(muertas), 0))::float as mortandad,
      sum(registros)::int as registros
    from pj
    group by grouping sets ((galpon, fila), (galpon))
    order by galpon, es_total desc, fila`;

  const novedades = await sql`
    select e.id, e.tipo, e.datos, e.creado, s.id as jaula_id, s.galpon, s.fila, s.numero, u.nombre
    from eventos_vigentes e
    join jaulas_estado s on s.id = e.jaula_id
    join usuarios u on u.id = e.usuario_id
    where e.tipo in ('problema', 'sanidad')
      and (${tipoNov}::text is null or e.tipo = ${tipoNov}::text)
      and (${galpon}::int is null or s.galpon = ${galpon}::int)
      and (e.creado at time zone ${TZ})::date between ${desde}::date and ${hasta}::date
    order by e.creado desc limit 200`;

  const porOperario = await sql`
    select u.nombre, to_char((e.creado at time zone ${TZ})::date, 'YYYY-MM-DD') as dia,
      count(*)::int as registros, count(distinct e.jaula_id)::int as jaulas
    from eventos_vigentes e
    join usuarios u on u.id = e.usuario_id
    join jaulas_estado s on s.id = e.jaula_id
    where e.tipo not in ('ajuste_aves')
      and (${galpon}::int is null or s.galpon = ${galpon}::int)
      and (e.creado at time zone ${TZ})::date between ${desde}::date and ${hasta}::date
    group by u.nombre, 2 order by 2 desc, u.nombre`;

  return (
    <>
      <h1>Reportes de la muestra</h1>
      <form className="tarjeta filtros" method="get">
        <div className="campo">
          <label htmlFor="desde">Desde</label>
          <input id="desde" type="date" name="desde" defaultValue={desde} />
        </div>
        <div className="campo">
          <label htmlFor="hasta">Hasta</label>
          <input id="hasta" type="date" name="hasta" defaultValue={hasta} />
        </div>
        <div className="campo">
          <label htmlFor="galpon">Galpón</label>
          <select id="galpon" name="galpon" defaultValue={galpon ?? ""}>
            <option value="">Todos</option>
            {galpones.map((g) => (
              <option key={g.numero} value={g.numero}>
                Galpón {g.numero}
              </option>
            ))}
          </select>
        </div>
        <button className="btn primario" type="submit">
          Ver
        </button>
      </form>

      <div className="tarjeta">
        <h2 style={{ marginTop: 0 }}>Postura y mortandad por fila</h2>
        <p className="suave">
          <small>
            Como la muestra no cubre todas las jaulas, se mide por ave. Postura = huevos por ave por día con registro de
            huevos. Mortandad = aves muertas en el período sobre aves de la muestra. Se usan las aves actuales de cada
            jaula.
          </small>
        </p>
        {resumen.length === 0 ? (
          <p className="suave">
            No hay jaulas cargadas. <Link href="/admin/jaulas">Cargar jaulas</Link>
          </p>
        ) : (
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Galpón / fila</th>
                  <th className="num">Jaulas</th>
                  <th className="num">Aves</th>
                  <th className="num">Huevos</th>
                  <th className="num">Huevos por ave por día</th>
                  <th className="num">Rotos</th>
                  <th className="num">Sucios</th>
                  <th className="num">Muertas</th>
                  <th className="num">Mortandad</th>
                  <th className="num">Registros</th>
                </tr>
              </thead>
              <tbody>
                {resumen.map((r) => (
                  <tr key={`${r.galpon}-${r.fila ?? "t"}`} style={r.es_total ? { fontWeight: 700, background: "#faf7f0" } : undefined}>
                    <td>{r.es_total ? `Galpón ${r.galpon}` : `Fila ${r.fila}`}</td>
                    <td className="num">{r.jaulas}</td>
                    <td className="num">{r.aves}</td>
                    <td className="num">{r.huevos}</td>
                    <td className="num">{dec(r.postura)}</td>
                    <td className="num">{pct(r.p_rotos)}</td>
                    <td className="num">{pct(r.p_sucios)}</td>
                    <td className="num">{r.muertas}</td>
                    <td className="num">{pct(r.mortandad)}</td>
                    <td className="num">{r.registros}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="tarjeta">
        <div className="acciones-linea" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Problemas y sanidad ({novedades.length})</h2>
          <div className="acciones-linea">
            {[
              { v: "", l: "Todos" },
              { v: "problema", l: "Problemas" },
              { v: "sanidad", l: "Sanidad" },
            ].map((o) => {
              const q = new URLSearchParams({ desde, hasta, ...(galpon ? { galpon: String(galpon) } : {}), ...(o.v ? { tipo: o.v } : {}) });
              return (
                <Link key={o.v} href={`/admin/reportes?${q}`} className={`chip ${(tipoNov ?? "") === o.v ? "yema" : ""}`}>
                  {o.l}
                </Link>
              );
            })}
          </div>
        </div>
        {novedades.length === 0 ? (
          <p className="suave">Sin novedades en el período.</p>
        ) : (
          <div className="tabla-scroll" style={{ marginTop: "0.75rem" }}>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Jaula</th>
                  <th>Tipo</th>
                  <th>Detalle</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {novedades.map((n) => (
                  <tr key={n.id}>
                    <td>{fechaHora(n.creado)}</td>
                    <td>
                      <Link href={`/admin/jaulas/${n.jaula_id}`}>{codigoJaula(n.galpon, n.fila, n.numero)}</Link>
                    </td>
                    <td>{NOMBRE_EVENTO[n.tipo]}</td>
                    <td>{detalleEvento(n.tipo, n.datos)}</td>
                    <td>{n.nombre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="tarjeta">
        <h2 style={{ marginTop: 0 }}>Registros por operario</h2>
        {porOperario.length === 0 ? (
          <p className="suave">Sin registros en el período.</p>
        ) : (
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Día</th>
                  <th>Usuario</th>
                  <th className="num">Jaulas</th>
                  <th className="num">Registros</th>
                </tr>
              </thead>
              <tbody>
                {porOperario.map((r, i) => (
                  <tr key={i}>
                    <td>{diaCorto(r.dia)}</td>
                    <td>{r.nombre}</td>
                    <td className="num">{r.jaulas}</td>
                    <td className="num">{r.registros}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
