import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUsuario } from "@/lib/auth";
import { Barra } from "@/components/Barra";
import { codigoJaula, hora, NOMBRE_EVENTO, TZ } from "@/lib/format";

export const metadata = { title: "Gallinero" };

export default async function Inicio() {
  const [{ n }] = await db()`select count(*)::int as n from usuarios`;
  if (n === 0) redirect("/setup");
  const u = await requireUsuario("/");
  if (u.rol === "admin") redirect("/admin");

  const sql = db();
  const registros = await sql`
    select e.tipo, e.creado, s.galpon, s.fila, s.numero
    from eventos_vigentes e join jaulas_estado s on s.id = e.jaula_id
    where e.usuario_id = ${u.id} and e.tipo <> 'ajuste_aves'
      and (e.creado at time zone ${TZ})::date = (now() at time zone ${TZ})::date
    order by e.creado desc limit 50`;
  const juntadas = await sql`
    select maples, creado from movimientos_vigentes
    where usuario_id = ${u.id} and tipo = 'juntada'
      and (creado at time zone ${TZ})::date = (now() at time zone ${TZ})::date
    order by creado desc`;
  const jaulasHoy = new Set(registros.map((r) => `${r.galpon}-${r.fila}-${r.numero}`)).size;

  return (
    <>
      <Barra u={u} />
      <main className="contenedor angosto">
        <div className="tarjeta centro" style={{ padding: "2rem 1rem" }}>
          <div style={{ fontSize: "3rem" }} aria-hidden>
            📱
          </div>
          <h1>Apoyá el celular en una etiqueta</h1>
          <p className="suave">Se abre sola la jaula o la carga de la juntada. No hace falta buscar nada acá.</p>
        </div>

        <h2>Hoy</h2>
        <div className="grilla">
          <div className="tarjeta">
            <small>Jaulas registradas</small>
            <div className="cifra">{jaulasHoy}</div>
          </div>
          <div className="tarjeta">
            <small>Maples juntados</small>
            <div className="cifra">{juntadas.reduce((a, j) => a + j.maples, 0)}</div>
          </div>
        </div>

        {registros.length > 0 && (
          <div className="tarjeta">
            <table>
              <tbody>
                {registros.map((r, i) => (
                  <tr key={i}>
                    <td>{codigoJaula(r.galpon, r.fila, r.numero)}</td>
                    <td>{NOMBRE_EVENTO[r.tipo]}</td>
                    <td className="num">{hora(r.creado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
