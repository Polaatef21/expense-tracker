// Shared setup for API integration tests: a real app wired to the TEST database.
// Every user created here has an @api-test.example email and is deleted
// (with their categories and transactions, via ON DELETE CASCADE) afterwards.
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createDatabase } from '../../src/db/index.js';
import { silentLogger } from '../../src/utils/logger.js';
import { createTestApp } from './app.js';
import { testDbConfig } from './db.js';

export const TEST_EMAIL_DOMAIN = 'api-test.example';
export const uniqueEmail = (prefix = 'user') => `${prefix}-${randomUUID().slice(0, 8)}@${TEST_EMAIL_DOMAIN}`;

export function createApiContext(appOptions = {}) {
  const db = createDatabase(testDbConfig(), { logger: silentLogger });
  const app = createTestApp({ db, ...appOptions });

  return {
    db,
    app,
    api: () => request(app),

    async registerUser({ name = 'Test User', email = uniqueEmail(), password = 'password123' } = {}) {
      const res = await request(app).post('/api/auth/register').send({ name, email, password });
      if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
      const { token, user } = res.body;
      return { token, user, password, auth: { Authorization: `Bearer ${token}` } };
    },

    async categoryId(auth, name) {
      const res = await request(app).get('/api/categories').set(auth);
      const category = res.body.data.find((c) => c.name === name);
      if (!category) throw new Error(`category not found: ${name}`);
      return category.id;
    },

    async createTransaction(auth, body) {
      const res = await request(app).post('/api/transactions').set(auth).send(body);
      if (res.status !== 201) throw new Error(`create failed: ${res.status} ${JSON.stringify(res.body)}`);
      return res.body.data;
    },

    async cleanup() {
      await db.query('DELETE FROM users WHERE email LIKE $1', [`%@${TEST_EMAIL_DOMAIN}`]);
    },

    async close() {
      await this.cleanup();
      await db.close();
    },
  };
}
