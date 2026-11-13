import Link from "next/link";
import type { Usuario } from "@/lib/auth";
import { salir } from "@/app/actions/sesion";
import { NavAdmin } from "./NavAdmin";

export function Barra({ u }: { u: Usuario }) {
  return (
    <header className="barra">
      <Link href={u.rol === "admin" ? "/admin" : "/"} className="marca">
        <span className="huevo" /> Gallinero
      </Link>
      {u.rol === "admin" && <NavAdmin />}
      <div className="usuario-barra">
        <span>{u.nombre}</span>
        <form action={salir}>
          <button className="btn chico" type="submit">
            Salir
          </button>
        </form>
      </div>
    </header>
  );
}
