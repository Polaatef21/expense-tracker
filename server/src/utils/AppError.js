// An error that is safe to show to the client.
// Throw it from controllers/services for expected failures (bad input, not found, ...).
// Any other error is treated as unexpected and reported as a generic 500.
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
