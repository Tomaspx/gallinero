import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { codigoJaula, fechaHora } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { BotonAnular } from "@/components/BotonAnular";
import { darDeBajaEtiqueta, generarEtiquetas } from "@/app/actions/admin";

export const metadata = { title: "Etiquetas · Gallinero" };

async function origen() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function Etiquetas() {
  await requireAdmin("/admin/etiquetas");
  const base = await origen();
  const etiquetas = await db()`
    select e.id, e.codigo, e.tipo, e.estado, e.creado, e.asignada, s.galpon, s.fila, s.numero
    from etiquetas e left join jaulas_estado s on s.id = e.jaula_id
    order by e.estado, e.asignada desc nulls last, e.creado desc`;
  const sinAsignar = etiquetas.filter((e) => e.estado === "sin_asignar");
  const activas = etiquetas.filter((e) => e.estado === "activa");
  const bajas = etiquetas.filter((e) => e.estado === "reemplazada");
  const destino = (e: (typeof etiquetas)[number]) =>
    e.tipo === "general" ? "Parche general" : e.galpon ? codigoJaula(e.galpon, e.fila, e.numero) : "—";

  return (
    <>
      <h1>Etiquetas NFC</h1>
      <div className="tarjeta">
        <h2 style={{ marginTop: 0 }}>Cómo dar de alta etiquetas</h2>
        <ol>
          <li>Generá códigos acá abajo.</li>
          <li>
            Grabá cada link en una etiqueta con la app <strong>NFC Tools</strong>: opción Escribir, agregar un registro de tipo URL.
          </li>
          <li>Pegá la etiqueta en la jaula o donde termina la juntada.</li>
          <li>Apoyá tu celular: como es nueva, te pide elegir a qué jaula corresponde o si es el parche general.</li>
          <li>Cuando la probaste, protegela con la opción de contraseña de NFC Tools, para que nadie la reescriba.</li>
        </ol>
        <ActionForm action={generarEtiquetas} boton="Generar códigos">
          <div className="campo" style={{ maxWidth: 220 }}>
            <label htmlFor="cantidad">Cantidad</label>
            <input id="cantidad" name="cantidad" inputMode="numeric" defaultValue={10} required />
          </div>
        </ActionForm>
      </div>

      <div className="tarjeta">
        <h2 style={{ marginTop: 0 }}>Sin asignar ({sinAsignar.length})</h2>
        {sinAsignar.length === 0 ? (
          <p className="suave">No hay códigos pendientes de grabar.</p>
        ) : (
          <div className="tabla-scroll">
            <table>
              <tbody>
                {sinAsignar.map((e) => (
                  <tr key={e.id}>
                    <td className="links-etiquetas">{`${base}/t/${e.codigo}`}</td>
                    <td>
                      <BotonAnular id={e.id} action={darDeBajaEtiqueta} label="Descartar" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="tarjeta">
        <h2 style={{ marginTop: 0 }}>Activas ({activas.length})</h2>
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Corresponde a</th>
                <th>Asignada</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {activas.map((e) => (
                <tr key={e.id}>
                  <td>
                    <a href={`/t/${e.codigo}`}>{e.codigo}</a>
                  </td>
                  <td>{destino(e)}</td>
                  <td>{fechaHora(e.asignada)}</td>
                  <td>
                    <BotonAnular id={e.id} action={darDeBajaEtiqueta} label="Dar de baja" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="suave">
          <small>Si una etiqueta se rompe, pegá una nueva y asignala a la misma jaula: la anterior se da de baja sola.</small>
        </p>
      </div>

      {bajas.length > 0 && (
        <details className="tarjeta">
          <summary>Dadas de baja ({bajas.length})</summary>
          <table>
            <tbody>
              {bajas.map((e) => (
                <tr key={e.id}>
                  <td>{e.codigo}</td>
                  <td>{destino(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </>
  );
}
