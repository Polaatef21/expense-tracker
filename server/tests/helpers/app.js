import { createApp } from '../../src/app.js';
import { silentLogger } from '../../src/utils/logger.js';

export const TEST_CLIENT_ORIGIN = 'http://localhost:5173';

export const testAppConfig = {
  nodeEnv: 'test',
  port: 0,
  clientOrigins: [TEST_CLIENT_ORIGIN],
  auth: {
    jwtSecret: 'test-only-secret-that-is-at-least-32-characters-long',
    jwtExpiresIn: '1h',
    saltRounds: 4, // bcrypt's minimum, keeps tests fast (real config requires 10-15)
  },
  rateLimit: { windowMs: 60_000, authMax: 1_000 },
};

// Builds the real app with test-safe defaults; pass `db` (and optionally a logger)
export function createTestApp({ db, logger = silentLogger, ...options }) {
  return createApp({ db, config: testAppConfig, logger, ...options });
}

// A logger that records calls, for asserting what was (or wasn't) logged
export function createSpyLogger() {
  const calls = { info: [], warn: [], error: [] };
  return {
    calls,
    info: (...args) => calls.info.push(args),
    warn: (...args) => calls.warn.push(args),
    error: (...args) => calls.error.push(args),
  };
}
