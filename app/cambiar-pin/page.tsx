import { redirect } from "next/navigation";
import { rutaSegura, usuarioActual } from "@/lib/auth";
import { cambiarPin } from "@/app/actions/sesion";
import { ActionForm } from "@/components/ActionForm";

export const metadata = { title: "Cambiar PIN · Gallinero" };

export default async function CambiarPin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const u = await usuarioActual();
  if (!u) redirect("/login");
  const next = rutaSegura((await searchParams).next, u.rol === "admin" ? "/admin" : "/");

  return (
    <main className="contenedor angosto">
      <div className="tarjeta" style={{ marginTop: "2rem" }}>
        <h1>{u.debe_cambiar_pin ? `Hola, ${u.nombre}` : "Cambiar PIN"}</h1>
        <p className="suave">
          {u.debe_cambiar_pin
            ? "Antes de empezar, elegí tu propio PIN de 4 números. Solo vos lo vas a saber."
            : "Elegí un PIN nuevo de 4 números."}
        </p>
        <ActionForm action={cambiarPin} boton="Guardar PIN" botonClass="btn primario ancho">
          <input type="hidden" name="next" value={next} />
          <div className="fila-campos">
            <div className="campo">
              <label htmlFor="pin">PIN nuevo</label>
              <input id="pin" name="pin" className="pin" type="password" inputMode="numeric" maxLength={4} required />
            </div>
            <div className="campo">
              <label htmlFor="pin2">Repetilo</label>
              <input id="pin2" name="pin2" className="pin" type="password" inputMode="numeric" maxLength={4} required />
            </div>
          </div>
        </ActionForm>
      </div>
    </main>
  );
}
