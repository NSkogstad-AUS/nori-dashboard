// postgres.js returns raw snake_case rows; @nori/contracts' zod schemas use camelCase (see
// packages/contracts/src/entities.ts — the mapping is systematic, e.g. workspace_id <->
// workspaceId). This is the one shared conversion used by every query function in
// packages/db/src/queries/, rather than hand-mapping fields per query.

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

/**
 * Shallow snake_case -> camelCase key conversion for a single Postgres row, plus `Date` ->
 * ISO-string conversion (postgres.js returns `timestamptz` columns as JS `Date` objects, but
 * @nori/contracts' schemas use `z.string().datetime()`). Does not recurse into nested
 * objects/arrays (e.g. `device`/`limits` jsonb columns come back already camelCase from the
 * application layer that wrote them, so no jsonb column in the current schema needs conversion —
 * revisit this helper if a future jsonb column is written with snake_case keys).
 */
export function rowToCamelCase<T>(row: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[snakeToCamel(key)] = value instanceof Date ? value.toISOString() : value;
  }
  return result as T;
}
