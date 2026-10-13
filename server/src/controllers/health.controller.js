import { describeError } from '../utils/describeError.js';
import { withTimeout } from '../utils/withTimeout.js';

// GET /api/health
//   200 { status: "ok",    database: "up"   } server and database are fine
//   503 { status: "error", database: "down" } server runs but the database is unreachable
// The database error itself is only logged, never returned (it may reveal host/user names).
export function createHealthController({ db, logger, timeoutMs }) {
  return async function getHealth(req, res) {
    res.set('Cache-Control', 'no-store');
    const timestamp = new Date().toISOString();
    try {
      await withTimeout(db.ping(), timeoutMs, 'Database health check');
      res.status(200).json({ status: 'ok', database: 'up', timestamp });
    } catch (err) {
      logger.error(`Health check: database unavailable: ${describeError(err)}`);
      res.status(503).json({ status: 'error', database: 'down', timestamp });
    }
  };
}
