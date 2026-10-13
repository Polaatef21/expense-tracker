// Database access module: wraps a pg connection pool.
// The app receives this object instead of importing a global pool, so tests
// can supply a connection to the test database (or a deliberately broken one).
import pg from 'pg';
import { describeError } from '../utils/describeError.js';

// Return DATE columns as plain 'YYYY-MM-DD' strings. The default converts them
// to JavaScript Dates at local midnight, which can shift the day across time zones.
pg.types.setTypeParser(1082, (value) => value);
// Return BIGINT (ids, counts) as numbers when they fit safely, instead of strings
pg.types.setTypeParser(20, (value) => {
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : value;
});
// NUMERIC (money) stays a string on purpose: JavaScript numbers can't hold it exactly.

export function createDatabase(connection, { logger }) {
  const pool = new pg.Pool({
    ...connection,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  // An idle client can lose its connection (e.g. PostgreSQL restarts).
  // Without this listener that error would crash the whole process.
  pool.on('error', (err) => {
    logger.error(`Unexpected error on idle PostgreSQL client: ${describeError(err)}`);
  });

  return {
    // Always pass user input through `params` ($1, $2, ...), never string concatenation
    query: (text, params) => pool.query(text, params),

    // Runs `fn(client)` inside BEGIN/COMMIT on one dedicated connection.
    // Any error rolls back everything `fn` did, then is re-thrown.
    async withTransaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },

    ping: async () => {
      await pool.query('SELECT 1');
    },
    close: () => pool.end(),
  };
}
