import { AppError } from '../utils/AppError.js';

// Validates and normalizes req.params / req.query / req.body with zod schemas.
// Clean values go to req.validated.{params,query,body}; unknown fields are dropped,
// so clients can't sneak in extra columns (e.g. user_id).
// All problems are reported together as 400 VALIDATION_ERROR with per-field details.
export function validate(schemas) {
  return (req, res, next) => {
    const validated = {};
    const details = [];

    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (result.success) {
        validated[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          details.push({ field: issue.path.join('.') || part, message: issue.message });
        }
      }
    }

    if (details.length > 0) {
      return next(new AppError(400, 'VALIDATION_ERROR', 'Please correct the highlighted fields', details));
    }
    req.validated = validated;
    return next();
  };
}
