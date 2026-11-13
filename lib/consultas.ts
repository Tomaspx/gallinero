import type postgres from "postgres";

/** Stock de maples: último recuento + juntadas − salidas posteriores (solo movimientos vigentes). */
export async function stockActual(sql: postgres.Sql): Promise<{ stock: number; ultimoRecuento: Date | null }> {
  const [r] = await sql`
    with rec as (
      select maples, creado, id from movimientos_vigentes
      where tipo = 'recuento' order by creado desc, id desc limit 1
    )
    select
      (coalesce((select maples from rec), 0) + coalesce(sum(
        case when m.tipo = 'juntada' then m.maples when m.tipo = 'salida' then -m.maples else 0 end
      ), 0))::int as stock,
      (select creado from rec) as ultimo_recuento
    from movimientos_vigentes m
    where m.tipo in ('juntada', 'salida')
      and ((select id from rec) is null or (m.creado, m.id) > ((select creado from rec), (select id from rec)))`;
  return { stock: r.stock, ultimoRecuento: r.ultimo_recuento };
}

const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // sin 0/O, 1/I/L para leerlos sin errores

export function codigoAleatorio(largo = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(largo));
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
}
