// Aplica las migraciones pendientes. Corre automáticamente antes de cada build.
// Si no hay base de datos configurada, avisa y sigue (la app muestra cómo conectarla).
import postgres from "postgres";
import { randomBytes } from "node:crypto";

const url =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

const migraciones = [
  {
    id: 1,
    nombre: "esquema inicial",
    sql: `
      create table app_settings (
        clave text primary key,
        valor text not null
      );

      create table galpones (
        id serial primary key,
        numero int not null unique check (numero > 0),
        creado timestamptz not null default now()
      );

      create table filas (
        id serial primary key,
        galpon_id int not null references galpones(id),
        numero int not null check (numero > 0),
        unique (galpon_id, numero)
      );

      create table jaulas (
        id serial primary key,
        fila_id int not null references filas(id),
        numero int not null check (numero > 0),
        activa boolean not null default true,
        creado timestamptz not null default now(),
        unique (fila_id, numero)
      );

      create table usuarios (
        id serial primary key,
        nombre text not null,
        usuario text not null unique,
        pin_hash text not null,
        rol text not null check (rol in ('operario', 'admin')),
        activo boolean not null default true,
        debe_cambiar_pin boolean not null default true,
        intentos_fallidos int not null default 0,
        bloqueado_hasta timestamptz,
        version_sesion int not null default 1,
        creado timestamptz not null default now()
      );

      create table etiquetas (
        id serial primary key,
        codigo text not null unique,
        tipo text check (tipo in ('jaula', 'general')),
        jaula_id int references jaulas(id),
        estado text not null default 'sin_asignar'
          check (estado in ('sin_asignar', 'activa', 'reemplazada')),
        creado timestamptz not null default now(),
        asignada timestamptz,
        asignada_por int references usuarios(id)
      );
      create unique index etiqueta_activa_por_jaula
        on etiquetas (jaula_id) where estado = 'activa' and tipo = 'jaula';
      create unique index un_solo_parche_general
        on etiquetas (tipo) where estado = 'activa' and tipo = 'general';

      -- Historial de jaulas: nunca se borra ni se edita. Una anulación es un evento nuevo.
      create table eventos (
        id bigserial primary key,
        jaula_id int not null references jaulas(id),
        usuario_id int not null references usuarios(id),
        tipo text not null check (tipo in
          ('ok', 'mortandad', 'huevos', 'problema', 'sanidad', 'ajuste_aves', 'anulacion')),
        datos jsonb not null default '{}',
        anula_id bigint references eventos(id),
        creado timestamptz not null default now()
      );
      create index eventos_jaula_creado on eventos (jaula_id, creado desc);
      create index eventos_creado on eventos (creado desc);
      create unique index una_anulacion_por_evento on eventos (anula_id) where anula_id is not null;

      -- Historial de stock de huevos, en maples. Mismo criterio: solo se agregan filas.
      create table movimientos_stock (
        id bigserial primary key,
        tipo text not null check (tipo in ('juntada', 'salida', 'recuento', 'anulacion')),
        maples int not null default 0 check (maples >= 0),
        destino text,
        nota text,
        usuario_id int not null references usuarios(id),
        anula_id bigint references movimientos_stock(id),
        creado timestamptz not null default now()
      );
      create index movimientos_creado on movimientos_stock (creado desc);
      create unique index una_anulacion_por_movimiento on movimientos_stock (anula_id) where anula_id is not null;

      create view eventos_vigentes as
        select e.* from eventos e
        where e.tipo <> 'anulacion'
          and not exists (select 1 from eventos a where a.anula_id = e.id);

      create view movimientos_vigentes as
        select m.* from movimientos_stock m
        where m.tipo <> 'anulacion'
          and not exists (select 1 from movimientos_stock a where a.anula_id = m.id);

      -- Aves actuales = último ajuste menos la mortandad registrada después.
      create view jaulas_estado as
        select
          j.id, j.numero, j.activa, j.fila_id,
          f.numero as fila, g.id as galpon_id, g.numero as galpon,
          aj.cantidad - coalesce(m.muertas, 0) as aves,
          ult.creado as ultimo_registro,
          ult.tipo as ultimo_tipo,
          ult.usuario_id as ultimo_usuario_id
        from jaulas j
        join filas f on f.id = j.fila_id
        join galpones g on g.id = f.galpon_id
        left join lateral (
          select (datos->>'cantidad')::int as cantidad, creado
          from eventos_vigentes
          where jaula_id = j.id and tipo = 'ajuste_aves'
          order by creado desc, id desc limit 1
        ) aj on true
        left join lateral (
          select sum((datos->>'cantidad')::int)::int as muertas
          from eventos_vigentes
          where jaula_id = j.id and tipo = 'mortandad'
            and (aj.creado is null or creado > aj.creado)
        ) m on true
        left join lateral (
          select creado, tipo, usuario_id
          from eventos_vigentes
          where jaula_id = j.id and tipo <> 'ajuste_aves'
          order by creado desc, id desc limit 1
        ) ult on true;
    `,
  },
];

async function main() {
  if (!url) {
    console.warn(
      "[migrate] No hay DATABASE_URL ni POSTGRES_URL: se saltean las migraciones. " +
        "Conectá la base de datos y volvé a publicar."
    );
    return;
  }
  const local = /localhost|127\.0\.0\.1/.test(url);
  const limpia = new URL(url);
  limpia.search = ""; // el SSL se configura aparte; Supabase agrega parámetros que postgres.js no acepta
  const sql = postgres(limpia.toString(), { prepare: false, ssl: local ? false : "require", max: 1, onnotice: () => {} });
  try {
    await sql.begin(async (tx) => {
      // Evita que dos builds migren a la vez.
      await tx`select pg_advisory_xact_lock(7314001)`;
      await tx`create table if not exists schema_migrations (
        id int primary key, nombre text not null, aplicada timestamptz not null default now())`;
      const hechas = new Set((await tx`select id from schema_migrations`).map((r) => r.id));
      for (const m of migraciones) {
        if (hechas.has(m.id)) continue;
        console.log(`[migrate] Aplicando ${m.id}: ${m.nombre}`);
        await tx.unsafe(m.sql);
        await tx`insert into schema_migrations (id, nombre) values (${m.id}, ${m.nombre})`;
      }
      // Clave para firmar las sesiones, generada una sola vez y guardada en la base.
      await tx`insert into app_settings (clave, valor)
               values ('session_secret', ${randomBytes(32).toString("hex")})
               on conflict (clave) do nothing`;
    });
    console.log("[migrate] Base de datos al día.");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error("[migrate] Error:", e.message);
  process.exit(1);
});
