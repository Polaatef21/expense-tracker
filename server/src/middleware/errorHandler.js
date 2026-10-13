import { AppError } from '../utils/AppError.js';

// Errors raised by express.json() while reading the request body
const BODY_PARSER_ERRORS = {
  'entity.parse.failed': [400, 'INVALID_JSON', 'Request body is not valid JSON'],
  'entity.too.large': [413, 'PAYLOAD_TOO_LARGE', 'Request body is too large'],
  'encoding.unsupported': [415, 'UNSUPPORTED_ENCODING', 'Unsupported content encoding'],
  'charset.unsupported': [415, 'UNSUPPORTED_CHARSET', 'Unsupported character set'],
};

// Central error handler: every error ends up here and is turned into
//   { "error": { "code": "...", "message": "..." } }
// Unexpected errors are logged in full on the server but the client only
// gets a generic message, so internal details (SQL, stack traces) never leak.
export function createErrorHandler(logger) {
  // Express recognizes error handlers by their 4 arguments, so `next` must stay
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    if (res.headersSent) return next(err);

    if (err instanceof AppError) {
      const body = { code: err.code, message: err.message };
      if (err.details) body.details = err.details;
      return res.status(err.status).json({ error: body });
    }

    const parserError = BODY_PARSER_ERRORS[err.type];
    if (parserError) {
      const [status, code, message] = parserError;
      return res.status(status).json({ error: { code, message } });
    }

    logger.error(`Unhandled error on ${req.method} ${req.path}:`, err);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again later.' },
    });
  };
}
