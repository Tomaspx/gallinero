import Link from "next/link";
import { db } from "@/lib/db";
import { requireUsuario } from "@/lib/auth";
import { Barra } from "@/components/Barra";
import { codigoJaula, detalleEvento, fechaHora, hace, hora, NOMBRE_EVENTO, TZ } from "@/lib/format";
import { JaulaPantalla } from "./JaulaPantalla";
import { JuntadaPantalla } from "./JuntadaPantalla";
import { AsignarEtiqueta } from "./AsignarEtiqueta";

export const metadata = { title: "Etiqueta · Gallinero" };

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="tarjeta centro" style={{ padding: "2rem 1rem" }}>
      <h1>{titulo}</h1>
      <p className="suave">{texto}</p>
    </div>
  );
}

export default async function Etiqueta({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<{ asignada?: string }>;
}) {
  const codigo = (await params).codigo.toUpperCase().slice(0, 20);
  const recienAsignada = (await searchParams).asignada === "1";
  const u = await requireUsuario(`/t/${codigo}`);
  const sql = db();
  const [et] = await sql`select id, codigo, tipo, jaula_id, estado from etiquetas where codigo = ${codigo}`;

  let contenido: React.ReactNode;

  if (!et) {
    contenido = <Aviso titulo="Etiqueta desconocida" texto="Este código no está en el sistema. Avisale al administrador." />;
  } else if (et.estado === "reemplazada") {
    contenido = (
      <Aviso
        titulo="Etiqueta dada de baja"
        texto="Esta etiqueta fue reemplazada por otra y ya no se usa. Avisale al administrador para que la retire."
      />
    );
  } else if (et.estado === "sin_asignar") {
    if (u.rol !== "admin") {
      contenido = (
        <Aviso titulo="Etiqueta sin asignar" texto="Esta etiqueta todavía no tiene jaula. Avisale al administrador." />
      );
    } else {
      const jaulas = await sql`
        select s.id, s.galpon, s.fila, s.numero, s.aves,
               exists (select 1 from etiquetas e where e.jaula_id = s.id and e.estado = 'activa') as con_etiqueta
        from jaulas_estado s where s.activa
        order by s.galpon, s.fila, s.numero`;
      const [gen] = await sql`select 1 from etiquetas where tipo = 'general' and estado = 'activa'`;
      contenido = (
        <AsignarEtiqueta
          codigo={codigo}
          hayGeneral={!!gen}
          jaulas={jaulas.map((j) => ({
            id: j.id,
            codigo: codigoJaula(j.galpon, j.fila, j.numero),
            conEtiqueta: j.con_etiqueta,
          }))}
        />
      );
    }
  } else if (et.tipo === "general") {
    const hoy = await sql`
      select m.maples, m.creado, u.nombre from movimientos_vigentes m join usuarios u on u.id = m.usuario_id
      where m.tipo = 'juntada' and (m.creado at time zone ${TZ})::date = (now() at time zone ${TZ})::date
      order by m.creado desc`;
    contenido = (
      <>
        {recienAsignada && <p className="msg ok">Listo: esta etiqueta quedó como parche general.</p>}
        <JuntadaPantalla />
        {hoy.length > 0 && (
          <div className="tarjeta">
            <h3 style={{ marginTop: 0 }}>Juntadas de hoy</h3>
            <table>
              <tbody>
                {hoy.map((j, i) => (
                  <tr key={i}>
                    <td>{hora(j.creado)}</td>
                    <td>{j.nombre}</td>
                    <td className="num">{j.maples} maples</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  } else {
    const [j] = await sql`
      select s.*, us.nombre as ultimo_nombre
      from jaulas_estado s left join usuarios us on us.id = s.ultimo_usuario_id
      where s.id = ${et.jaula_id}`;
    const ultimos = await sql`
      select e.tipo, e.datos, e.creado, us.nombre
      from eventos_vigentes e join usuarios us on us.id = e.usuario_id
      where e.jaula_id = ${et.jaula_id} order by e.creado desc, e.id desc limit 5`;
    const cod = codigoJaula(j.galpon, j.fila, j.numero);
    contenido = (
      <>
        {recienAsignada && <p className="msg ok">Listo: esta etiqueta quedó asignada a la jaula {cod}.</p>}
        <div className="cabecera-jaula">
          <div className="codigo">{cod}</div>
          <div className="datos-jaula">
            <span>
              <strong>{j.aves ?? "?"}</strong> aves
            </span>
            <span>
              Último registro: <strong>{j.ultimo_registro ? hace(j.ultimo_registro) : "nunca"}</strong>
              {j.ultimo_nombre ? ` (${j.ultimo_nombre})` : ""}
            </span>
          </div>
        </div>
        {!j.activa ? (
          <Aviso titulo="Jaula desactivada" texto="Esta jaula no está en uso. Avisale al administrador." />
        ) : (
          <JaulaPantalla jaulaId={j.id} codigo={cod} aves={j.aves} esAdmin={u.rol === "admin"} />
        )}
        {ultimos.length > 0 && (
          <details className="tarjeta">
            <summary>Últimos registros</summary>
            <table>
              <tbody>
                {ultimos.map((e, i) => (
                  <tr key={i}>
                    <td>{fechaHora(e.creado)}</td>
                    <td>
                      {NOMBRE_EVENTO[e.tipo]}
                      <br />
                      <small>{detalleEvento(e.tipo, e.datos)}</small>
                    </td>
                    <td>{e.nombre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {u.rol === "admin" && (
              <p>
                <Link href={`/admin/jaulas/${j.id}`}>Ver historial completo</Link>
              </p>
            )}
          </details>
        )}
      </>
    );
  }

  return (
    <>
      <Barra u={u} />
      <main className="contenedor angosto">{contenido}</main>
    </>
  );
}
