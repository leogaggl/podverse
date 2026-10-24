export function readQueryResultRows(value: unknown): unknown[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const first: unknown = value[0];
  // Postgres UPDATE and DELETE results from TypeORM are [rows, affectedCount].
  if (Array.isArray(first)) {
    return first;
  }

  return value;
}
