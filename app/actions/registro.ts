"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { usuarioEnAccion } from "@/lib/auth";
import { confirmar, entero, error, ok, texto, type Resultado } from "@/lib/resultado";
import { hace, hora, MOTIVOS_AJUSTE, MOTIVOS_PROBLEMA, MOTIVOS_SANIDAD, NOMBRE_EVENTO, TZ } from "@/lib/format";

const MINUTOS_DUPLICADO = 2;

export async function registrarEvento(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await usuarioEnAccion();
  const sql = db();
  const jaulaId = entero(fd, "jaula_id", 1, 1e9);
  const tipo = texto(fd, "tipo", 20);
  if (!jaulaId || !(tipo in NOMBRE_EVENTO) || tipo === "anulacion") return error("Registro inválido.");

  const [jaula] = await sql`select id, activa, aves from jaulas_estado where id = ${jaulaId}`;
  if (!jaula) return error("La jaula no existe.");
  if (!jaula.activa) return error("Esta jaula está desactivada. Avisale al administrador.");

  let datos: Record<string, string | number> = {};
  switch (tipo) {
    case "ok":
      break;
    case "mortandad": {
      const max = jaula.aves ?? 20;
      const cantidad = entero(fd, "cantidad", 1, Math.max(1, max));
      if (!cantidad) return error(`La cantidad tiene que ser entre 1 y ${max} (aves en la jaula).`);
      datos = { cantidad };
      break;
    }
    case "huevos": {
      const buenos = entero(fd, "buenos", 0, 500);
      const rotos = entero(fd, "rotos", 0, 500);
      const sucios = entero(fd, "sucios", 0, 500);
      if (buenos === null || rotos === null || sucios === null) return error("Revisá las cantidades.");
      if (buenos + rotos + sucios === 0) return error("Cargá al menos un huevo, o usá “Todo OK”.");
      datos = { buenos, rotos, sucios };
      break;
    }
    case "problema":
    case "sanidad": {
      const motivos = tipo === "problema" ? MOTIVOS_PROBLEMA : MOTIVOS_SANIDAD;
      const motivo = texto(fd, "motivo", 20);
      if (!(motivo in motivos)) return error("Elegí una opción.");
      const nota = texto(fd, "nota", 300);
      if (motivo === "otro" && !nota) return error("Contá brevemente cuál es el problema.");
      datos = nota ? { motivo, nota } : { motivo };
      break;
    }
    case "ajuste_aves": {
      if (u.rol !== "admin") return error("Solo el administrador ajusta la cantidad de aves.");
      const cantidad = entero(fd, "cantidad", 0, 50);
      const motivo = texto(fd, "motivo", 20);
      if (cantidad === null) return error("La cantidad tiene que ser entre 0 y 50.");
      if (!(motivo in MOTIVOS_AJUSTE)) return error("Elegí el motivo.");
      const nota = texto(fd, "nota", 300);
      datos = nota ? { cantidad, motivo, nota } : { cantidad, motivo };
      break;
    }
  }

  if (fd.get("confirmar") !== "1" && tipo !== "ajuste_aves") {
    const [previo] = await sql`
      select tipo, creado from eventos_vigentes
      where jaula_id = ${jaulaId} and usuario_id = ${u.id} and tipo <> 'ajuste_aves'
        and creado > now() - make_interval(mins => ${MINUTOS_DUPLICADO})
      order by creado desc limit 1`;
    if (previo)
      return confirmar(
        `Ya registraste esta jaula ${hace(previo.creado)} (${NOMBRE_EVENTO[previo.tipo]}). ¿Registrar de nuevo?`
      );
  }

  const [nuevo] = await sql`
    insert into eventos (jaula_id, usuario_id, tipo, datos)
    values (${jaulaId}, ${u.id}, ${tipo}, ${sql.json(datos)})
    returning creado`;
  revalidatePath("/", "layout");
  return ok(NOMBRE_EVENTO[tipo], { hora: hora(nuevo.creado) });
}

export async function registrarJuntada(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await usuarioEnAccion();
  const sql = db();
  const maples = entero(fd, "maples", 1, 5000);
  if (!maples) return error("Cargá la cantidad de maples juntados.");

  if (fd.get("confirmar") !== "1") {
    const [previa] = await sql`
      select m.maples, m.creado, u.nombre from movimientos_vigentes m join usuarios u on u.id = m.usuario_id
      where m.tipo = 'juntada' and (m.creado at time zone ${TZ})::date = (now() at time zone ${TZ})::date
      order by m.creado desc limit 1`;
    if (previa)
      return confirmar(
        `Hoy ya se cargó una juntada de ${previa.maples} maples a las ${hora(previa.creado)} (${previa.nombre}). ¿Es una juntada nueva?`
      );
  }

  const [nuevo] = await sql`
    insert into movimientos_stock (tipo, maples, usuario_id) values ('juntada', ${maples}, ${u.id})
    returning creado`;
  revalidatePath("/", "layout");
  return ok(`${maples} maples sumados al stock`, { hora: hora(nuevo.creado) });
}

export async function asignarEtiqueta(_: Resultado, fd: FormData): Promise<Resultado> {
  const u = await usuarioEnAccion(true);
  const codigo = texto(fd, "codigo", 20).toUpperCase();
  const tipo = texto(fd, "tipo", 10);
  const jaulaId = entero(fd, "jaula_id", 1, 1e9);
  if (tipo !== "jaula" && tipo !== "general") return error("Elegí si la etiqueta es de una jaula o el parche general.");
  if (tipo === "jaula" && !jaulaId) return error("Elegí la jaula.");

  const res = await db().begin(async (tx) => {
    const [et] = await tx`select id, estado from etiquetas where codigo = ${codigo} for update`;
    if (!et) return "La etiqueta no existe.";
    if (et.estado !== "sin_asignar") return "Esta etiqueta ya fue asignada.";
    if (tipo === "jaula") {
      const [j] = await tx`select id from jaulas where id = ${jaulaId} and activa`;
      if (!j) return "La jaula no existe o está desactivada.";
      await tx`update etiquetas set estado = 'reemplazada'
               where jaula_id = ${jaulaId} and tipo = 'jaula' and estado = 'activa'`;
    } else {
      await tx`update etiquetas set estado = 'reemplazada' where tipo = 'general' and estado = 'activa'`;
    }
    await tx`update etiquetas set tipo = ${tipo}, jaula_id = ${tipo === "jaula" ? jaulaId : null},
             estado = 'activa', asignada = now(), asignada_por = ${u.id}
             where id = ${et.id}`;
    return null;
  });
  if (res) return error(res);
  revalidatePath("/", "layout");
  redirect(`/t/${codigo}?asignada=1`);
}
