import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from './client.js';

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

async function main() {
  const sql = getDb();
  await sql`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `;

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const [row] = await sql<{ exists: boolean }[]>`
      select exists(select 1 from schema_migrations where name = ${file}) as exists
    `;
    if (row?.exists) {
      console.log(`skip  ${file} (already applied)`);
      continue;
    }
    const contents = await readFile(path.join(migrationsDir, file), 'utf8');
    console.log(`apply ${file}`);
    await sql.unsafe(contents);
    await sql`insert into schema_migrations (name) values (${file})`;
  }

  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
