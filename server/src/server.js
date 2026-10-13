// Entry point: loads config, connects to PostgreSQL, starts the HTTP server,
// and shuts down cleanly on Ctrl+C / SIGTERM.
import { createApp } from './app.js';
import { getDbConfig } from './config/db.js';
import { getAppConfig } from './config/env.js';
import { createDatabase } from './db/index.js';
import { describeError } from './utils/describeError.js';
import { logger } from './utils/logger.js';

let config;
let db;
try {
  config = getAppConfig();
  db = createDatabase(getDbConfig({ test: config.nodeEnv === 'test' }), { logger });
} catch (err) {
  logger.error(`Invalid configuration: ${err.message}`);
  process.exit(1);
}

const app = createApp({ db, config, logger });

const server = app.listen(config.port, (err) => {
  if (err) {
    logger.error(
      err.code === 'EADDRINUSE'
        ? `Port ${config.port} is already in use. Stop the other process or change PORT in server/.env`
        : `Server failed to start: ${describeError(err)}`,
    );
    process.exit(1);
  }
  logger.info(`API listening on http://localhost:${config.port} (${config.nodeEnv})`);
});

// Report database status at startup without crashing: the server stays up and
// /api/health shows "down" until PostgreSQL becomes reachable.
db.ping()
  .then(() => logger.info('Connected to PostgreSQL'))
  .catch((err) => logger.error(`Could not connect to PostgreSQL: ${describeError(err)}`));

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, shutting down...`);

  // Stop accepting requests, finish in-flight ones, then close the pool
  server.close(async () => {
    await db.close().catch(() => {});
    logger.info('Shutdown complete');
    process.exit(0);
  });
  // Don't hang forever if a connection refuses to close
  setTimeout(() => {
    logger.error('Forced shutdown after 10s');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
