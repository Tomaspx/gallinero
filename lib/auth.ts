import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";
import { db } from "./db";

export type Usuario = {
  id: number;
  nombre: string;
  usuario: string;
  rol: "operario" | "admin";
  debe_cambiar_pin: boolean;
  version_sesion: number;
};

const COOKIE = "sesion";
const DURACION_DIAS = 30;
let secretCache: Uint8Array | null = null;

async function secreto(): Promise<Uint8Array> {
  if (secretCache) return secretCache;
  const sql = db();
  await sql`insert into app_settings (clave, valor) values ('session_secret', ${randomBytes(32).toString("hex")})
            on conflict (clave) do nothing`;
  const [fila] = await sql`select valor from app_settings where clave = 'session_secret'`;
  secretCache = new TextEncoder().encode(fila.valor as string);
  return secretCache;
}

/** Crea (o renueva) la cookie de sesión. Solo se puede llamar desde server actions o route handlers. */
export async function crearSesion(u: { id: number; version_sesion: number }) {
  const token = await new SignJWT({ uid: u.id, v: u.version_sesion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACION_DIAS}d`)
    .sign(await secreto());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_DIAS * 24 * 3600,
  });
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE);
}

async function leerToken(): Promise<{ uid: number; v: number; iat: number } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await secreto());
    return { uid: Number(payload.uid), v: Number(payload.v), iat: Number(payload.iat) };
  } catch {
    return null;
  }
}

/** Usuario logueado, o null. Se valida contra la base en cada request (baja o reseteo de PIN cortan la sesión). */
export const usuarioActual = cache(async (): Promise<Usuario | null> => {
  const t = await leerToken();
  if (!t) return null;
  const [u] = await db()<Usuario[]>`
    select id, nombre, usuario, rol, debe_cambiar_pin, version_sesion
    from usuarios where id = ${t.uid} and activo and version_sesion = ${t.v}`;
  return u ?? null;
});

/** Para páginas: exige sesión (y PIN ya cambiado). */
export async function requireUsuario(volverA = "/"): Promise<Usuario> {
  const u = await usuarioActual();
  if (!u) redirect(`/login?next=${encodeURIComponent(volverA)}`);
  if (u.debe_cambiar_pin) redirect(`/cambiar-pin?next=${encodeURIComponent(volverA)}`);
  return u;
}

export async function requireAdmin(volverA = "/admin"): Promise<Usuario> {
  const u = await requireUsuario(volverA);
  if (u.rol !== "admin") redirect("/");
  return u;
}

/** Para server actions: devuelve el usuario y renueva la sesión si tiene más de un día. */
export async function usuarioEnAccion(soloAdmin = false): Promise<Usuario> {
  const u = await usuarioActual();
  if (!u || u.debe_cambiar_pin) redirect("/login");
  if (soloAdmin && u.rol !== "admin") throw new Error("Solo un administrador puede hacer esto.");
  const t = await leerToken();
  if (t && Date.now() / 1000 - t.iat > 24 * 3600) await crearSesion(u);
  return u;
}

/** Valida que un "next" sea una ruta interna, para no redirigir a otro sitio. */
export function rutaSegura(next: unknown, porDefecto = "/") {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : porDefecto;
}
