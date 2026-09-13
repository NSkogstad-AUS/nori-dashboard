import postgres from 'postgres';

type SqlClient = ReturnType<typeof postgres>;

// Next.js reloads server modules during development. A module-local singleton creates a
// fresh Postgres.js pool after each reload and leaves the previous pool alive, eventually
// exhausting every connection on the server. globalThis survives those reloads, so all
// copies of @nori/db in this process share one pool.
const globalForDb = globalThis as typeof globalThis & {
  __noriPostgresClient?: SqlClient;
};

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getDb(): SqlClient {
  if (!globalForDb.__noriPostgresClient) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
    }

    globalForDb.__noriPostgresClient = postgres(connectionString, {
      // Nori runs a web process and a worker process. Keeping each pool deliberately small
      // leaves room for migrations, tests, and database administration on modest instances.
      max: positiveInteger(process.env.DATABASE_POOL_MAX, 3),
      // Release connections that are no longer being used instead of retaining them forever.
      idle_timeout: positiveInteger(process.env.DATABASE_IDLE_TIMEOUT_SECONDS, 20),
      connect_timeout: positiveInteger(process.env.DATABASE_CONNECT_TIMEOUT_SECONDS, 10),
    });
  }

  return globalForDb.__noriPostgresClient;
}
