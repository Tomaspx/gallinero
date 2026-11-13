import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { configurarPrimerAdmin } from "@/app/actions/sesion";
import { ActionForm } from "@/components/ActionForm";

export const metadata = { title: "Configuración inicial · Gallinero" };

export default async function Setup() {
  const [{ n }] = await db()`select count(*)::int as n from usuarios`;
  if (n > 0) redirect("/login");

  return (
    <main className="contenedor angosto">
      <div className="tarjeta" style={{ marginTop: "2rem" }}>
        <h1>Bienvenido al gallinero</h1>
        <p className="suave">
          Creá el primer administrador. Después, desde el panel, vas a poder cargar galpones, jaulas, operarios y
          etiquetas.
        </p>
        <ActionForm action={configurarPrimerAdmin} boton="Crear administrador" botonClass="btn primario ancho">
          <div className="campo">
            <label htmlFor="nombre">Tu nombre</label>
            <input id="nombre" name="nombre" required />
          </div>
          <div className="campo">
            <label htmlFor="usuario">Usuario para ingresar</label>
            <input id="usuario" name="usuario" autoCapitalize="none" placeholder="ej. tomas" required />
          </div>
          <div className="fila-campos">
            <div className="campo">
              <label htmlFor="pin">PIN (4 números)</label>
              <input id="pin" name="pin" className="pin" type="password" inputMode="numeric" maxLength={4} required />
            </div>
            <div className="campo">
              <label htmlFor="pin2">Repetí el PIN</label>
              <input id="pin2" name="pin2" className="pin" type="password" inputMode="numeric" maxLength={4} required />
            </div>
          </div>
        </ActionForm>
      </div>
    </main>
  );
}
