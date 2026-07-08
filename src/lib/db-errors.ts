// Postgres unique_violation. Drizzle wraps the real pg error in a
// DrizzleQueryError and puts the original (with .code) on .cause rather
// than copying it up — the code must be read from there, not the wrapper.
const UNIQUE_VIOLATION = "23505";

function hasCode(value: unknown): value is { code: unknown } {
  return Boolean(value && typeof value === "object" && "code" in value);
}

export function isUniqueViolation(err: unknown): boolean {
  if (hasCode(err) && err.code === UNIQUE_VIOLATION) return true;
  const cause = err instanceof Error ? err.cause : undefined;
  return hasCode(cause) && cause.code === UNIQUE_VIOLATION;
}
