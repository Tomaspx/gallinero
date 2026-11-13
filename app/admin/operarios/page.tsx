import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { hace } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { cambiarEstadoUsuario, crearUsuario, desbloquearUsuario, resetearPin } from "@/app/actions/admin";

export const metadata = { title: "Usuarios · Gallinero" };

export default async function Operarios() {
  const yo = await requireAdmin("/admin/operarios");
  const usuarios = await db()`
    select u.id, u.nombre, u.usuario, u.rol, u.activo, u.debe_cambiar_pin, u.bloqueado_hasta,
      (select max(creado) from eventos e where e.usuario_id = u.id) as ultimo_registro
    from usuarios u order by u.activo desc, u.rol, u.nombre`;

  return (
    <>
      <h1>Usuarios</h1>

      <div className="tarjeta">
        <h2 style={{ marginTop: 0 }}>Nuevo usuario</h2>
        <ActionForm action={crearUsuario} boton="Crear usuario" limpiarAlGuardar>
          <div className="fila-campos">
            <div className="campo">
              <label htmlFor="nombre">Nombre</label>
              <input id="nombre" name="nombre" required />
            </div>
            <div className="campo">
              <label htmlFor="usuario">Usuario</label>
              <input id="usuario" name="usuario" autoCapitalize="none" placeholder="ej. juan" required />
            </div>
            <div className="campo">
              <label htmlFor="rol">Rol</label>
              <select id="rol" name="rol" defaultValue="operario">
                <option value="operario">Operario</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="pin">PIN inicial</label>
              <input id="pin" name="pin" inputMode="numeric" maxLength={4} placeholder="4 números" required />
            </div>
          </div>
          <p className="suave">
            <small>Pasale el usuario y el PIN inicial. En el primer ingreso elige su propio PIN.</small>
          </p>
        </ActionForm>
      </div>

      <div className="tarjeta">
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Último registro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                const bloqueado = u.bloqueado_hasta && new Date(u.bloqueado_hasta) > new Date();
                return (
                  <tr key={u.id} className={u.activo ? undefined : "anulado"}>
                    <td>
                      {u.nombre}{" "}
                      {bloqueado && <span className="chip rojo">bloqueado</span>}{" "}
                      {u.debe_cambiar_pin && u.activo && <span className="chip yema">PIN inicial</span>}
                    </td>
                    <td>{u.usuario}</td>
                    <td>{u.rol === "admin" ? "Administrador" : "Operario"}</td>
                    <td>{hace(u.ultimo_registro)}</td>
                    <td>
                      <div className="acciones-linea">
                        {bloqueado && (
                          <form action={desbloquearUsuario}>
                            <input type="hidden" name="id" value={u.id} />
                            <button className="btn chico">Desbloquear</button>
                          </form>
                        )}
                        {u.id !== yo.id && (
                          <form action={cambiarEstadoUsuario}>
                            <input type="hidden" name="id" value={u.id} />
                            <button className="btn chico">{u.activo ? "Dar de baja" : "Reactivar"}</button>
                          </form>
                        )}
                        {u.activo && (
                          <details>
                            <summary className="btn chico">Resetear PIN</summary>
                            <ActionForm action={resetearPin} boton="Guardar" botonClass="btn chico primario">
                              <input type="hidden" name="id" value={u.id} />
                              <input name="pin" inputMode="numeric" maxLength={4} placeholder="PIN nuevo" required style={{ margin: "0.4rem 0" }} />
                            </ActionForm>
                          </details>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
