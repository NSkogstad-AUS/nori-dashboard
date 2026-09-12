import postgres from 'postgres';

let sqlSingleton: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (!sqlSingleton) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
    }
    sqlSingleton = postgres(connectionString);
  }
  return sqlSingleton;
}
