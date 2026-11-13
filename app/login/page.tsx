import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { rutaSegura, usuarioActual } from "@/lib/auth";
import { ingresar } from "@/app/actions/sesion";
import { ActionForm } from "@/components/ActionForm";

export const metadata = { title: "Ingresar · Gallinero" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = rutaSegura((await searchParams).next);
  const [{ n }] = await db()`select count(*)::int as n from usuarios`;
  if (n === 0) redirect("/setup");
  const u = await usuarioActual();
  if (u && !u.debe_cambiar_pin) redirect(next);

  return (
    <main className="contenedor angosto">
      <div className="centro" style={{ margin: "2rem 0 1.25rem" }}>
        <span className="marca" style={{ justifyContent: "center", fontSize: "1.3rem" }}>
          <span className="huevo" /> Gallinero
        </span>
      </div>
      <div className="tarjeta">
        <h1>Ingresar</h1>
        {next.startsWith("/t/") && (
          <p className="suave">Ingresá una vez y después alcanza con apoyar el celular en las etiquetas.</p>
        )}
        <ActionForm action={ingresar} boton="Ingresar" botonClass="btn primario ancho">
          <input type="hidden" name="next" value={next} />
          <div className="campo">
            <label htmlFor="usuario">Usuario</label>
            <input
              id="usuario"
              name="usuario"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </div>
          <div className="campo">
            <label htmlFor="pin">PIN</label>
            <input
              id="pin"
              name="pin"
              className="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              autoComplete="current-password"
              required
            />
          </div>
        </ActionForm>
      </div>
      <p className="suave centro">
        <small>En iPhone usá Safari directamente, sin “agregar a inicio”, así no te pide el PIN cada vez.</small>
      </p>
    </main>
  );
}
