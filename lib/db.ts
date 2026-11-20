import postgres from "postgres";

// Single server-side connection to the Supabase Postgres (transaction pooler).
// All tables live in the isolated `cardiacct` schema and are always fully qualified.
declare global {
  // eslint-disable-next-line no-var
  var __ctSql: ReturnType<typeof postgres> | undefined;
}

function make() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");
  // Use Supavisor *session* mode (5432) rather than transaction mode (6543): in transaction mode the
  // multi-step extended-protocol exchange postgres.js uses for parameterized queries can be split
  // across backends when queries run concurrently, which left requests hanging.
  const url = raw.replace(/\.pooler\.supabase\.com:6543\//, ".pooler.supabase.com:5432/");
  // max_pipeline is a supported runtime option that is missing from postgres.js's TypeScript types.
  const options = {
    prepare: false,
    max_pipeline: 1,
    max: 3,
    idle_timeout: 10,
    max_lifetime: 60 * 5,
    connect_timeout: 15,
    ssl: "require" as const,
  };
  return postgres(url, options as postgres.Options<Record<string, postgres.PostgresType>>);
}

export function db() {
  if (!globalThis.__ctSql) globalThis.__ctSql = make();
  return globalThis.__ctSql;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const rows = await db()`select value from cardiacct.settings where key = ${key}`;
  return rows.length ? (rows[0].value as T) : fallback;
}

export async function setSetting(key: string, value: unknown) {
  await db()`insert into cardiacct.settings (key, value) values (${key}, ${db().json(value as never)})
    on conflict (key) do update set value = excluded.value`;
}
