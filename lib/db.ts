import postgres from "postgres";

/** Busca la conexión: DATABASE_URL, POSTGRES_URL o la misma con el prefijo que haya puesto Vercel (ej. STORAGE_POSTGRES_URL). */
function buscarUrl(): string | undefined {
  const env = process.env;
  if (env.DATABASE_URL) return env.DATABASE_URL;
  const claves = Object.keys(env);
  const pooler = claves.find((k) => /(^|_)POSTGRES_URL$/.test(k));
  const directa = claves.find((k) => /(^|_)POSTGRES_URL_NON_POOLING$/.test(k));
  return (pooler && env[pooler]) || (directa && env[directa]) || undefined;
}

export const dbUrl = buscarUrl();

/** Quita los parámetros extra (sslmode, supa, pgbouncer…) que agrega Supabase: el SSL se configura aparte. */
export function limpiarUrl(url: string) {
  const u = new URL(url);
  u.search = "";
  return u.toString();
}

const globalForDb = globalThis as unknown as { __sql?: postgres.Sql };

function crear(): postgres.Sql {
  if (!dbUrl) throw new Error("Falta configurar la base de datos (DATABASE_URL o POSTGRES_URL).");
  const local = /localhost|127\.0\.0\.1/.test(dbUrl);
  return postgres(limpiarUrl(dbUrl), {
    prepare: false, // necesario con el pooler de Supabase en modo transacción
    ssl: local ? false : "require",
    max: 5,
    idle_timeout: 20,
    onnotice: () => {},
  });
}

/** Cliente de Postgres compartido (se reutiliza entre requests). */
export function db(): postgres.Sql {
  if (!globalForDb.__sql) globalForDb.__sql = crear();
  return globalForDb.__sql;
}
