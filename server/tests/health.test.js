import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../src/db/index.js';
import { silentLogger } from '../src/utils/logger.js';
import { createSpyLogger, createTestApp, TEST_CLIENT_ORIGIN } from './helpers/app.js';
import { testDbConfig } from './helpers/db.js';

describe('GET /api/health with the test database', () => {
  let db;
  let app;

  beforeAll(() => {
    db = createDatabase(testDbConfig(), { logger: silentLogger });
    app = createTestApp({ db });
  });

  afterAll(async () => {
    await db.close();
  });

  it('returns 200 with server and database status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ status: 'ok', database: 'up', timestamp: expect.any(String) });
    expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
  });

  it('is never cached', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('sends security headers and hides the framework', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['strict-transport-security']).toBeDefined();
  });

  it('allows CORS from the configured front-end origin', async () => {
    const res = await request(app).get('/api/health').set('Origin', TEST_CLIENT_ORIGIN);
    expect(res.headers['access-control-allow-origin']).toBe(TEST_CLIENT_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('does not grant CORS to other origins', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers CORS preflight requests for the allowed origin', async () => {
    const res = await request(app)
      .options('/api/health')
      .set('Origin', TEST_CLIENT_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type, Authorization');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(TEST_CLIENT_ORIGIN);
    expect(res.headers['access-control-allow-headers']).toBe('Content-Type,Authorization');
    expect(res.headers['access-control-allow-methods']).toContain('DELETE');
  });
});

describe('GET /api/health when the database is unavailable', () => {
  async function healthWith(connectionOverrides, options = {}) {
    const logger = createSpyLogger();
    const db = createDatabase({ ...testDbConfig(), ...connectionOverrides }, { logger });
    try {
      const res = await request(createTestApp({ db, logger, ...options })).get('/api/health');
      return { res, logger };
    } finally {
      await db.close();
    }
  }

  function expectSafe503(res) {
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'error', database: 'down', timestamp: expect.any(String) });
    // The underlying database error must not reach the client
    const raw = JSON.stringify(res.body).toLowerCase();
    for (const leak of ['password', 'authentication', 'expense_app', 'econnrefused', '127.0.0.1', 'localhost']) {
      expect(raw).not.toContain(leak);
    }
  }

  it('returns 503 without leaking details when the password is wrong', async () => {
    const { res, logger } = await healthWith({ password: 'definitely-not-the-password' });
    expectSafe503(res);
    // ...but the real reason is logged on the server for the developer
    expect(logger.calls.error.flat().join(' ')).toMatch(/password authentication failed/);
  });

  it('returns 503 when nothing is listening on the database port', async () => {
    const { res, logger } = await healthWith({ port: 1 });
    expectSafe503(res);
    expect(logger.calls.error.flat().join(' ')).toMatch(/ECONNREFUSED/);
  });

  it('returns 503 when the database does not exist', async () => {
    const { res } = await healthWith({ database: 'expense_tracker_missing_test' });
    expectSafe503(res);
  });

  it('returns 503 quickly when the database hangs instead of waiting forever', async () => {
    const logger = createSpyLogger();
    const hangingDb = { ping: () => new Promise(() => {}) };
    const app = createTestApp({ db: hangingDb, logger, healthTimeoutMs: 100 });

    const started = Date.now();
    const res = await request(app).get('/api/health');
    expect(Date.now() - started).toBeLessThan(1_000);
    expectSafe503(res);
    expect(logger.calls.error.flat().join(' ')).toMatch(/timed out after 100ms/);
  });
});

describe('unknown routes and malformed requests', () => {
  const app = createTestApp({ db: { ping: async () => {} } });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  it('returns a JSON 404 for an unsupported method on a known path', async () => {
    const res = await request(app).delete('/api/health');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for a malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"amount": 12,');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
  });

  it('returns 413 for a body larger than 10 KB', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ description: 'x'.repeat(11 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
