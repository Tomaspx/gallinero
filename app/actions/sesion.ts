"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { cerrarSesion, crearSesion, rutaSegura, usuarioActual } from "@/lib/auth";
import { error, formatoUsuario, texto, type Resultado } from "@/lib/resultado";

const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 15;

export async function ingresar(_: Resultado, fd: FormData): Promise<Resultado> {
  const usuario = texto(fd, "usuario", 40).toLowerCase();
  const pin = texto(fd, "pin", 10);
  const next = rutaSegura(fd.get("next"));
  if (!usuario || !/^\d{4}$/.test(pin)) return error("Ingresá tu usuario y un PIN de 4 números.");

  const sql = db();
  const [u] = await sql`
    select id, pin_hash, activo, intentos_fallidos, bloqueado_hasta, debe_cambiar_pin, version_sesion
    from usuarios where usuario = ${usuario}`;
  if (!u || !u.activo) return error("Usuario o PIN incorrecto.");

  if (u.bloqueado_hasta && new Date(u.bloqueado_hasta) > new Date()) {
    const min = Math.ceil((new Date(u.bloqueado_hasta).getTime() - Date.now()) / 60000);
    return error(`Usuario bloqueado por demasiados intentos. Probá de nuevo en ${min} min o pedile al administrador que lo desbloquee.`);
  }

  if (!(await bcrypt.compare(pin, u.pin_hash))) {
    const intentos = u.intentos_fallidos + 1;
    if (intentos >= MAX_INTENTOS) {
      await sql`update usuarios set intentos_fallidos = 0,
                bloqueado_hasta = now() + make_interval(mins => ${MINUTOS_BLOQUEO}) where id = ${u.id}`;
      return error(`PIN incorrecto. El usuario quedó bloqueado ${MINUTOS_BLOQUEO} minutos.`);
    }
    await sql`update usuarios set intentos_fallidos = ${intentos} where id = ${u.id}`;
    const quedan = MAX_INTENTOS - intentos;
    return error(`Usuario o PIN incorrecto. ${quedan === 1 ? "Queda 1 intento" : `Quedan ${quedan} intentos`}.`);
  }

  await sql`update usuarios set intentos_fallidos = 0, bloqueado_hasta = null where id = ${u.id}`;
  await crearSesion(u as { id: number; version_sesion: number });
  if (u.debe_cambiar_pin) redirect(`/cambiar-pin?next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function configurarPrimerAdmin(_: Resultado, fd: FormData): Promise<Resultado> {
  const nombre = texto(fd, "nombre", 60);
  const usuario = texto(fd, "usuario", 40).toLowerCase();
  const pin = texto(fd, "pin", 10);
  const pin2 = texto(fd, "pin2", 10);
  if (!nombre) return error("Falta el nombre.");
  if (!formatoUsuario.test(usuario)) return error("El usuario lleva de 2 a 30 letras minúsculas, números, punto o guion.");
  if (!/^\d{4}$/.test(pin)) return error("El PIN tiene que ser de 4 números.");
  if (pin !== pin2) return error("Los dos PIN no coinciden.");

  const hash = await bcrypt.hash(pin, 10);
  const creado = await db().begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(7314002)`;
    const [{ n }] = await tx`select count(*)::int as n from usuarios`;
    if (n > 0) return null;
    const [u] = await tx`
      insert into usuarios (nombre, usuario, pin_hash, rol, debe_cambiar_pin)
      values (${nombre}, ${usuario}, ${hash}, 'admin', false)
      returning id, version_sesion`;
    return u;
  });
  if (!creado) return error("El sistema ya tiene usuarios. Ingresá con tu usuario.");
  await crearSesion(creado as { id: number; version_sesion: number });
  redirect("/admin");
}

export async function cambiarPin(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await usuarioActual();
  if (!u) redirect("/login");
  const pin = texto(fd, "pin", 10);
  const pin2 = texto(fd, "pin2", 10);
  const next = rutaSegura(fd.get("next"), u.rol === "admin" ? "/admin" : "/");
  if (!/^\d{4}$/.test(pin)) return error("El PIN tiene que ser de 4 números.");
  if (pin !== pin2) return error("Los dos PIN no coinciden.");
  if (/^(\d)\1{3}$/.test(pin) || ["1234", "4321", "0123"].includes(pin))
    return error("Elegí un PIN menos obvio.");

  const sql = db();
  const [actual] = await sql`select pin_hash from usuarios where id = ${u.id}`;
  if (await bcrypt.compare(pin, actual.pin_hash)) return error("El PIN nuevo tiene que ser distinto del anterior.");

  const hash = await bcrypt.hash(pin, 10);
  const [nuevo] = await sql`
    update usuarios set pin_hash = ${hash}, debe_cambiar_pin = false, version_sesion = version_sesion + 1
    where id = ${u.id} returning id, version_sesion`;
  await crearSesion(nuevo as { id: number; version_sesion: number });
  redirect(next);
}

export async function salir() {
  await cerrarSesion();
  redirect("/login");
}
