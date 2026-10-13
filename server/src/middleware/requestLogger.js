// Logs one line per request: method, path, status, duration.
// Deliberately omits query strings, headers, and bodies (may contain personal data or tokens).
export function createRequestLogger(logger) {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      // originalUrl is the full path (req.path is relative to the router); drop the query string
      const path = req.originalUrl.split('?')[0];
      logger.info(`${req.method} ${path} ${res.statusCode} ${ms.toFixed(1)}ms`);
    });
    next();
  };
}
