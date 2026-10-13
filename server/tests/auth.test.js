import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES } from '../src/constants/defaultCategories.js';
import { createApiContext, uniqueEmail } from './helpers/api.js';
import { createTestApp, testAppConfig } from './helpers/app.js';

const ctx = createApiContext();
const { jwtSecret } = testAppConfig.auth;

afterAll(() => ctx.close());

describe('POST /api/auth/register', () => {
  it('creates a user, returns a token, and never returns the password hash', async () => {
    const email = uniqueEmail('reg');
    const res = await ctx.api().post('/api/auth/register').send({ name: 'Ann Lee', email, password: 'secret123' });

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({ id: expect.any(Number), name: 'Ann Lee', email, createdAt: expect.any(String) });
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);

    const payload = jwt.verify(res.body.token, jwtSecret);
    expect(payload.sub).toBe(String(res.body.user.id));
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub']); // no personal data in the token
  });

  it('stores a bcrypt hash, not the plaintext password', async () => {
    const { user } = await ctx.registerUser({ password: 'plaintext1' });
    const { rows } = await ctx.db.query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/);
    expect(rows[0].password_hash).not.toContain('plaintext1');
  });

  it("creates the user's own copy of the default categories", async () => {
    const { user } = await ctx.registerUser();
    const { rows } = await ctx.db.query('SELECT name, type FROM categories WHERE user_id = $1', [user.id]);
    expect(rows).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(rows.filter((r) => r.type === 'income')).toHaveLength(5);
    expect(rows.filter((r) => r.type === 'expense')).toHaveLength(10);
    expect(rows.map((r) => r.name).sort()).toEqual(DEFAULT_CATEGORIES.map((c) => c.name).sort());
  });

  it('normalizes the email (trim + lowercase) and the name (trim)', async () => {
    const local = uniqueEmail('Case').split('@')[0];
    const res = await ctx.api()
      .post('/api/auth/register')
      .send({ name: '  Bob  ', email: `  ${local.toUpperCase()}@API-TEST.EXAMPLE `, password: 'secret123' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(`${local.toLowerCase()}@api-test.example`);
    expect(res.body.user.name).toBe('Bob');
  });

  it('rejects a duplicate email regardless of case with 409', async () => {
    const email = uniqueEmail('dup');
    await ctx.registerUser({ email });
    const res = await ctx.api().post('/api/auth/register').send({ name: 'X', email: email.toUpperCase(), password: 'secret123' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
    const { rows } = await ctx.db.query('SELECT count(*)::int AS n FROM users WHERE email = $1', [email]);
    expect(rows[0].n).toBe(1);
  });

  it('returns field-level validation errors', async () => {
    const res = await ctx.api().post('/api/auth/register').send({ name: '', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it.each([
    ['without a number', 'onlyletters', /letter and one number/],
    ['without a letter', '1234567890', /letter and one number/],
    ['longer than 72 bytes', `a1${'x'.repeat(71)}`, /at most 72 bytes/],
  ])('rejects a password %s', async (_label, password, message) => {
    const res = await ctx.api().post('/api/auth/register').send({ name: 'A', email: uniqueEmail(), password });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.message).join(' ')).toMatch(message);
  });

  it('ignores fields the client should not control', async () => {
    const res = await ctx.api()
      .post('/api/auth/register')
      .send({ name: 'Mallory', email: uniqueEmail(), password: 'secret123', id: 1, password_hash: 'x', isAdmin: true });
    expect(res.status).toBe(201);
    expect(res.body.user.id).not.toBe(1);
    expect(res.body.user).not.toHaveProperty('isAdmin');
  });

  it('is atomic: if creating default categories fails, the user is not created', async () => {
    // Wrap the real database so the categories INSERT fails inside the transaction
    const failingDb = {
      ...ctx.db,
      withTransaction: (fn) =>
        ctx.db.withTransaction((client) =>
          fn({
            query: (sql, params) =>
              sql.includes('INSERT INTO categories')
                ? Promise.reject(new Error('simulated failure'))
                : client.query(sql, params),
          }),
        ),
    };
    const app = createTestApp({ db: failingDb });
    const email = uniqueEmail('atomic');

    const res = await request(app).post('/api/auth/register').send({ name: 'A', email, password: 'secret123' });
    expect(res.status).toBe(500);
    const { rows } = await ctx.db.query('SELECT count(*)::int AS n FROM users WHERE email = $1', [email]);
    expect(rows[0].n).toBe(0);
  });
});

describe('POST /api/auth/login', () => {
  let email;
  beforeAll(async () => {
    email = uniqueEmail('login');
    await ctx.registerUser({ email, password: 'correct123' });
  });

  it('returns a token and the user for valid credentials (email is case-insensitive)', async () => {
    const res = await ctx.api().post('/api/auth/login').send({ email: email.toUpperCase(), password: 'correct123' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
    expect(jwt.verify(res.body.token, jwtSecret).sub).toBe(String(res.body.user.id));
  });

  it('returns the same 401 for a wrong password and for an unknown email', async () => {
    const wrongPassword = await ctx.api().post('/api/auth/login').send({ email, password: 'wrong1234' });
    const unknownEmail = await ctx.api().post('/api/auth/login').send({ email: uniqueEmail('nobody'), password: 'wrong1234' });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body).toEqual({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
  });

  it('validates input', async () => {
    const res = await ctx.api().post('/api/auth/login').send({ email: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['email', 'password']));
  });
});

describe('GET /api/auth/me and token handling', () => {
  let user;
  let auth;
  beforeAll(async () => {
    ({ user, auth } = await ctx.registerUser());
  });

  it('returns the current user for a valid token', async () => {
    const res = await ctx.api().get('/api/auth/me').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(user);
  });

  it.each([
    ['no Authorization header', undefined, 'AUTH_REQUIRED'],
    ['a non-Bearer scheme', 'Basic abc', 'AUTH_REQUIRED'],
    ['an empty Bearer token', 'Bearer ', 'AUTH_REQUIRED'],
    ['a garbage token', 'Bearer not.a.jwt', 'INVALID_TOKEN'],
  ])('rejects %s with 401', async (_label, header, code) => {
    const req = ctx.api().get('/api/auth/me');
    if (header !== undefined) req.set('Authorization', header);
    const res = await req;
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(code);
  });

  it('rejects a token signed with a different secret', async () => {
    const forged = jwt.sign({}, 'another-secret-another-secret-another-secret', { subject: String(user.id) });
    const res = await ctx.api().get('/api/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects an unsigned "alg: none" token', async () => {
    const unsigned = jwt.sign({ sub: String(user.id) }, null, { algorithm: 'none' });
    const res = await ctx.api().get('/api/auth/me').set('Authorization', `Bearer ${unsigned}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects an expired token with TOKEN_EXPIRED', async () => {
    const expired = jwt.sign({ exp: Math.floor(Date.now() / 1000) - 60 }, jwtSecret, { subject: String(user.id) });
    const res = await ctx.api().get('/api/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects a token whose user no longer exists', async () => {
    const { user: gone, auth: goneAuth } = await ctx.registerUser();
    await ctx.db.query('DELETE FROM users WHERE id = $1', [gone.id]);
    const res = await ctx.api().get('/api/auth/me').set(goneAuth);
    expect(res.status).toBe(401);
  });

  it.each(['/api/categories', '/api/transactions', '/api/dashboard', '/api/transactions/export?format=csv'])(
    'protects %s', async (path) => {
      const res = await ctx.api().get(path);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });
});

describe('rate limiting', () => {
  it('blocks repeated failed logins from the same client with 429', async () => {
    const limited = createApiContext({ config: { ...testAppConfig, rateLimit: { windowMs: 60_000, authMax: 3 } } });
    try {
      const attempt = () => limited.api().post('/api/auth/login').send({ email: uniqueEmail(), password: 'wrong1234' });
      const statuses = [];
      for (let i = 0; i < 4; i += 1) statuses.push((await attempt()).status);
      expect(statuses).toEqual([401, 401, 401, 429]);

      const blocked = await attempt();
      expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
      expect(blocked.headers.ratelimit).toBeDefined();
    } finally {
      await limited.close();
    }
  });
});
