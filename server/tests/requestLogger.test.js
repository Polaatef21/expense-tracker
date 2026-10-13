import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createSpyLogger, createTestApp } from './helpers/app.js';

describe('request logger', () => {
  it('logs the full path without the query string, plus status and duration', async () => {
    const logger = createSpyLogger();
    const app = createTestApp({ db: { ping: async () => {} }, logger });
    await request(app).get('/api/health?token=should-not-be-logged');
    const line = logger.calls.info.flat().join(' ');
    expect(line).toMatch(/^GET \/api\/health 200 \d+\.\dms$/);
    expect(line).not.toContain('should-not-be-logged');
  });
});
