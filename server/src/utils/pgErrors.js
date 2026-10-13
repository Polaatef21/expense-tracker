// Helpers for recognizing specific PostgreSQL constraint errors by name,
// so services can turn them into friendly API errors.
export const isUniqueViolation = (err, constraint) =>
  err?.code === '23505' && (!constraint || err.constraint === constraint);

export const isForeignKeyViolation = (err, constraint) =>
  err?.code === '23503' && (!constraint || err.constraint === constraint);
