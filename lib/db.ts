import postgres from "postgres";

// Single server-side connection to the Supabase Postgres (transaction pooler).
// All tables live in the isolated `cardiacct` schema and are always fully qualified.
declare global {
  // eslint-disable-next-line no-var
  var __ctSql: ReturnType<typeof postgres> | undefined;
}

function make() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return postgres(url, {
    prepare: false, // required for Supabase transaction pooler (port 6543)
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: "require",
  });
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
