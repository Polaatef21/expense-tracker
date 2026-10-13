// Tests the central error handler in isolation, using a tiny app with routes
// that fail on purpose.
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createErrorHandler } from '../src/middleware/errorHandler.js';
import { AppError } from '../src/utils/AppError.js';
import { createSpyLogger } from './helpers/app.js';

function buildApp(logger) {
  const app = express();
  app.get('/app-error', () => {
    throw new AppError(409, 'EMAIL_TAKEN', 'Email already registered');
  });
  app.get('/app-error-details', () => {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input', [{ field: 'amount', message: 'Must be positive' }]);
  });
  app.get('/sync-crash', () => {
    throw new Error('connect to postgres://expense_app:s3cret@localhost failed');
  });
  // Express 5 forwards rejected promises from async handlers automatically
  app.get('/async-crash', async () => {
    await Promise.resolve();
    throw new Error('relation "secret_table" does not exist');
  });
  app.use(createErrorHandler(logger));
  return app;
}

describe('error handler', () => {
  it('returns the status, code, and message of an AppError', async () => {
    const logger = createSpyLogger();
    const res = await request(buildApp(logger)).get('/app-error');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: 'EMAIL_TAKEN', message: 'Email already registered' } });
    expect(logger.calls.error).toHaveLength(0); // expected errors are not logged as failures
  });

  it('includes details when an AppError has them', async () => {
    const res = await request(buildApp(createSpyLogger())).get('/app-error-details');
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'amount', message: 'Must be positive' }]);
  });

  it.each(['/sync-crash', '/async-crash'])(
    'hides internal details of unexpected errors (%s)', async (path) => {
      const logger = createSpyLogger();
      const res = await request(buildApp(logger)).get(path);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again later.' },
      });
      const raw = JSON.stringify(res.body);
      expect(raw).not.toMatch(/s3cret|postgres|secret_table|stack/);
      // ...while the developer still gets the full error in the server log
      expect(logger.calls.error).toHaveLength(1);
      expect(logger.calls.error[0][1]).toBeInstanceOf(Error);
    });
});
