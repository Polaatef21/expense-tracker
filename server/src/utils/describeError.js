// Builds a useful one-line description of an error for server logs.
// Needed because some network errors have an empty `message`: when "localhost"
// resolves to both ::1 and 127.0.0.1 and both refuse, Node throws an
// AggregateError whose details live only in `code` and `errors`.
export function describeError(err) {
  if (!(err instanceof Error)) return String(err);

  const parts = [];
  if (err.message) parts.push(err.message);
  if (err.code && !err.message.includes(err.code)) parts.push(`[${err.code}]`);

  if (Array.isArray(err.errors) && err.errors.length > 0) {
    const inner = err.errors.map((e) => describeError(e)).join('; ');
    parts.push(`(${inner})`);
  }
  return parts.join(' ') || err.name;
}
