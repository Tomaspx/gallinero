"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { usuarioEnAccion } from "@/lib/auth";
import { codigoAleatorio, stockActual } from "@/lib/consultas";
import { confirmar, entero, error, formatoUsuario, ok, texto, type Resultado } from "@/lib/resultado";
import { NOMBRE_EVENTO } from "@/lib/format";

const refrescar = () => revalidatePath("/", "layout");

/* ---------- Stock de huevos ---------- */

export async function registrarSalida(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await usuarioEnAccion(true);
  const maples = entero(fd, "maples", 1, 100000);
  const destino = texto(fd, "destino", 80);
  const nota = texto(fd, "nota", 300);
  if (!maples) return error("Cargá la cantidad de maples.");
  if (!destino) return error("Indicá el destino: cliente o motivo.");
  const sql = db();
  const { stock } = await stockActual(sql);
  if (maples > stock && fd.get("confirmar") !== "1")
    return confirmar(`El stock es de ${stock} maples. Con esta salida quedaría en ${stock - maples}. ¿Registrarla igual?`);
  await sql`insert into movimientos_stock (tipo, maples, destino, nota, usuario_id)
            values ('salida', ${maples}, ${destino}, ${nota || null}, ${u.id})`;
  refrescar();
  return ok(`Salida de ${maples} maples registrada (${destino}).`);
}

export async function registrarRecuento(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await usuarioEnAccion(true);
  const maples = entero(fd, "maples", 0, 1000000);
  const nota = texto(fd, "nota", 300);
  if (maples === null) return error("Cargá los maples contados.");
  const sql = db();
  const { stock } = await stockActual(sql);
  if (fd.get("confirmar") !== "1")
    return confirmar(`El sistema tiene ${stock} maples y contaste ${maples}. El stock pasa a ser ${maples}. ¿Confirmás?`);
  await sql`insert into movimientos_stock (tipo, maples, nota, usuario_id)
            values ('recuento', ${maples}, ${nota || null}, ${u.id})`;
  refrescar();
  return ok(`Stock fijado en ${maples} maples.`);
}

export async function anularMovimiento(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await usuarioEnAccion(true);
  const id = entero(fd, "id", 1, 1e15);
  if (!id) return error("Movimiento inválido.");
  const sql = db();
  const [m] = await sql`select m.id, m.tipo, m.maples,
      exists (select 1 from movimientos_stock a where a.anula_id = m.id) as anulado
    from movimientos_stock m where m.id = ${id}`;
  if (!m || m.tipo === "anulacion") return error("Movimiento inválido.");
  if (m.anulado) return error("Ya estaba anulado.");
  if (fd.get("confirmar") !== "1") return confirmar(`¿Anular este movimiento de ${m.maples} maples?`);
  await sql`insert into movimientos_stock (tipo, maples, usuario_id, anula_id, nota)
            values ('anulacion', 0, ${u.id}, ${id}, 'Anulado por el administrador')
            on conflict do nothing`;
  refrescar();
  return ok("Anulado.");
}

/* ---------- Jaulas ---------- */

export async function crearJaulas(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await usuarioEnAccion(true);
  const galpon = entero(fd, "galpon", 1, 999);
  const fila = entero(fd, "fila", 1, 999);
  const desde = entero(fd, "desde", 1, 9999);
  const hasta = entero(fd, "hasta", 1, 9999);
  const aves = entero(fd, "aves", 0, 50);
  if (!galpon || !fila || !desde || !hasta) return error("Completá galpón, fila y el rango de jaulas.");
  if (hasta < desde) return error("“Hasta” tiene que ser mayor o igual que “desde”.");
  if (hasta - desde > 499) return error("Máximo 500 jaulas por vez.");
  if (aves === null) return error("Indicá cuántas aves tiene cada jaula (0 a 50).");

  const creadas = await db().begin(async (tx) => {
    const [g] = await tx`insert into galpones (numero) values (${galpon})
      on conflict (numero) do update set numero = excluded.numero returning id`;
    const [f] = await tx`insert into filas (galpon_id, numero) values (${g.id}, ${fila})
      on conflict (galpon_id, numero) do update set numero = excluded.numero returning id`;
    const numeros = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
    const nuevas = await tx`
      insert into jaulas (fila_id, numero)
      select ${f.id}, n from unnest(${numeros}::int[]) as n
      on conflict (fila_id, numero) do nothing
      returning id`;
    if (nuevas.length > 0) {
      const ids = nuevas.map((j) => j.id as number);
      await tx`insert into eventos (jaula_id, usuario_id, tipo, datos)
        select j, ${u.id}, 'ajuste_aves', ${tx.json({ cantidad: aves, motivo: "ingreso" })}
        from unnest(${ids}::int[]) as j`;
    }
    return nuevas.length;
  });
  refrescar();
  const total = hasta - desde + 1;
  if (creadas === 0) return error("Esas jaulas ya existían; no se creó ninguna.");
  return ok(
    `Se crearon ${creadas} jaulas en el galpón ${galpon}, fila ${fila}` +
      (creadas < total ? ` (${total - creadas} ya existían).` : ".")
  );
}

export async function cambiarEstadoJaula(fd: FormData) {
  await usuarioEnAccion(true);
  const id = entero(fd, "id", 1, 1e9);
  if (!id) return;
  await db()`update jaulas set activa = not activa where id = ${id}`;
  refrescar();
}

export async function anularEvento(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await usuarioEnAccion(true);
  const id = entero(fd, "id", 1, 1e15);
  if (!id) return error("Registro inválido.");
  const sql = db();
  const [e] = await sql`select e.id, e.jaula_id, e.tipo,
      exists (select 1 from eventos a where a.anula_id = e.id) as anulado
    from eventos e where e.id = ${id}`;
  if (!e || e.tipo === "anulacion") return error("Registro inválido.");
  if (e.anulado) return error("Ya estaba anulado.");
  if (fd.get("confirmar") !== "1") return confirmar(`¿Anular este registro de ${NOMBRE_EVENTO[e.tipo]}?`);
  await sql`insert into eventos (jaula_id, usuario_id, tipo, datos, anula_id)
            values (${e.jaula_id}, ${u.id}, 'anulacion', ${sql.json({ anula_id: id })}, ${id})
            on conflict do nothing`;
  refrescar();
  return ok("Anulado.");
}

/* ---------- Usuarios ---------- */

export async function crearUsuario(_: Resultado, fd: FormData): Promise<Resultado> {
  await usuarioEnAccion(true);
  const nombre = texto(fd, "nombre", 60);
  const usuario = texto(fd, "usuario", 40).toLowerCase();
  const rol = texto(fd, "rol", 10);
  const pin = texto(fd, "pin", 10);
  if (!nombre) return error("Falta el nombre.");
  if (!formatoUsuario.test(usuario)) return error("El usuario lleva de 2 a 30 letras minúsculas, números, punto o guion.");
  if (rol !== "operario" && rol !== "admin") return error("Elegí el rol.");
  if (!/^\d{4}$/.test(pin)) return error("El PIN inicial tiene que ser de 4 números.");
  const hash = await bcrypt.hash(pin, 10);
  const [nuevo] = await db()`
    insert into usuarios (nombre, usuario, pin_hash, rol) values (${nombre}, ${usuario}, ${hash}, ${rol})
    on conflict (usuario) do nothing returning id`;
  if (!nuevo) return error(`Ya existe el usuario “${usuario}”.`);
  refrescar();
  return ok(`Listo. ${nombre} entra con el usuario “${usuario}” y el PIN ${pin}; lo cambia en el primer ingreso.`);
}

export async function resetearPin(_: Resultado, fd: FormData): Promise<Resultado> {
  await usuarioEnAccion(true);
  const id = entero(fd, "id", 1, 1e9);
  const pin = texto(fd, "pin", 10);
  if (!id) return error("Usuario inválido.");
  if (!/^\d{4}$/.test(pin)) return error("El PIN tiene que ser de 4 números.");
  const hash = await bcrypt.hash(pin, 10);
  await db()`update usuarios set pin_hash = ${hash}, debe_cambiar_pin = true, intentos_fallidos = 0,
             bloqueado_hasta = null, version_sesion = version_sesion + 1 where id = ${id}`;
  refrescar();
  return ok(`PIN reseteado a ${pin}. Se le va a pedir cambiarlo al entrar.`);
}

export async function cambiarEstadoUsuario(fd: FormData) {
  const u = await usuarioEnAccion(true);
  const id = entero(fd, "id", 1, 1e9);
  if (!id || id === u.id) return;
  await db()`update usuarios set activo = not activo, version_sesion = version_sesion + 1 where id = ${id}`;
  refrescar();
}

export async function desbloquearUsuario(fd: FormData) {
  await usuarioEnAccion(true);
  const id = entero(fd, "id", 1, 1e9);
  if (!id) return;
  await db()`update usuarios set intentos_fallidos = 0, bloqueado_hasta = null where id = ${id}`;
  refrescar();
}

/* ---------- Etiquetas ---------- */

export async function generarEtiquetas(_: Resultado, fd: FormData): Promise<Resultado> {
  await usuarioEnAccion(true);
  const n = entero(fd, "cantidad", 1, 200);
  if (!n) return error("Generá entre 1 y 200 códigos por vez.");
  const sql = db();
  let creados = 0;
  for (let intento = 0; intento < 5 && creados < n; intento++) {
    const codigos = Array.from({ length: n - creados }, () => codigoAleatorio());
    const filas = await sql`insert into etiquetas (codigo) select unnest(${codigos}::text[])
                            on conflict (codigo) do nothing returning id`;
    creados += filas.length;
  }
  refrescar();
  return ok(`Se generaron ${creados} códigos nuevos. Están abajo, en “Sin asignar”.`);
}

export async function darDeBajaEtiqueta(_: Resultado, fd: FormData): Promise<Resultado> {
  await usuarioEnAccion(true);
  const id = entero(fd, "id", 1, 1e9);
  if (!id) return error("Etiqueta inválida.");
  if (fd.get("confirmar") !== "1") return confirmar("¿Dar de baja esta etiqueta? Su link deja de funcionar.");
  await db()`update etiquetas set estado = 'reemplazada' where id = ${id} and estado <> 'reemplazada'`;
  refrescar();
  return ok("Etiqueta dada de baja.");
}
